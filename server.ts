/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import child_process from 'child_process';
import os from 'os';
import fs from 'fs';
import { CodexRuntimeEvent, correlateCodexRuntimeEvent, isLoopbackAddress, normalizeCodexHookPayload, reconcileCodexRuntimeHistory } from './src/services/codexRuntime';
import { ClaudeRuntimeEvent, correlateClaudeRuntimeEvent, normalizeClaudeHookPayload, reconcileClaudeRuntimeHistory } from './src/services/claudeRuntime';
import { mergeClaudeRuntimeSettings } from './src/services/claudeSettings';
import { findClaudeSessionCwd, findClaudeTelemetry, readClaudeDesktopOnlyTelemetry, readClaudeDesktopTelemetry, readClaudeProjectMemoryMetadata } from './src/services/claudeDesktopTelemetry';
import { isTrustedClaudeTelemetryOrigin } from './src/services/claudeTelemetryAccess';
import { CodexAppServerMonitor } from './src/services/codexAppServer';
import { readCodexRolloutTelemetry } from './src/services/codexRolloutTelemetry';
import { readCodexSkillSources } from './src/services/codexSkillSources';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const OBSERVATORY_PORT = Number(process.env.PORT) || 3000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const SENSITIVE_PATTERNS = [
  'auth.ts',
  'prod-secrets.yaml',
  'schema.prisma',
  'migrations',
  '.env',
  'rm -rf',
  'DROP TABLE',
  'eval(',
  'sudo',
];

const pendingApprovals = new Map<string, (decision: { action: string; prompt?: string }) => void>();
let realEventsHistory: Array<any> = [];
const CODEX_EVENT_HISTORY_LIMIT = 2000;
const CODEX_EVENT_JOURNAL_LIMIT_BYTES = 8 * 1024 * 1024;
const CODEX_EVENT_JOURNAL_PATH = process.env.CODEX_EVENT_JOURNAL_PATH || path.join(process.cwd(), '.codex', 'runtime-events.jsonl');
const CODEX_APP_SERVER_STATE_PATH = process.env.CODEX_APP_SERVER_STATE_PATH || path.join(process.cwd(), '.codex', 'runtime-appserver-state.json');
let codexEventsHistory: CodexRuntimeEvent[] = loadCodexRuntimeHistory();
const CLAUDE_EVENT_JOURNAL_PATH = process.env.CLAUDE_EVENT_JOURNAL_PATH || path.join(process.cwd(), '.claude', 'runtime-events.jsonl');
let claudeEventsHistory: ClaudeRuntimeEvent[] = loadClaudeRuntimeHistory();
const localWebSocketClients = new Set<WebSocket>();
const CODEX_HOOK_PORT = Number(process.env.CODEX_HOOK_PORT) || 7789;
const CLAUDE_HOOK_PORT = Number(process.env.AGENT_MATRIX_CLAUDE_HOOK_PORT) || 7788;
let codexHookGatewayState: 'starting' | 'listening' | 'offline' = 'starting';
let claudeHookGatewayState: 'starting' | 'listening' | 'offline' = 'starting';
let codexAppServerState: 'starting' | 'listening' | 'offline' = 'starting';
let codexAppServerMonitor: CodexAppServerMonitor | undefined;

function isCodexRuntimeEvent(value: unknown): value is CodexRuntimeEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Partial<CodexRuntimeEvent>;
  return event.provider === 'codex' && (event.source === 'codex-hook' || event.source === 'codex-app-server') &&
    typeof event.eventId === 'string' && typeof event.hookEventName === 'string' &&
    typeof event.phase === 'string' && typeof event.timestamp === 'string' &&
    !!event.payload && typeof event.payload === 'object';
}

function loadCodexRuntimeHistory(): CodexRuntimeEvent[] {
  try {
    if (!fs.existsSync(CODEX_EVENT_JOURNAL_PATH)) return [];
    const lines = fs.readFileSync(CODEX_EVENT_JOURNAL_PATH, 'utf8').split(/\r?\n/).filter(Boolean);
    const events = lines.flatMap((line) => {
      try {
        const parsed: unknown = JSON.parse(line);
        return isCodexRuntimeEvent(parsed) ? [parsed] : [];
      } catch {
        return [];
      }
    });
    return reconcileCodexRuntimeHistory(events.slice(-CODEX_EVENT_HISTORY_LIMIT));
  } catch {
    return [];
  }
}

function isClaudeRuntimeEvent(value: unknown): value is ClaudeRuntimeEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Partial<ClaudeRuntimeEvent>;
  return event.provider === 'claude' && event.source === 'claude-hook' && typeof event.eventId === 'string' && typeof event.hookEventName === 'string' && typeof event.phase === 'string' && typeof event.timestamp === 'string' && !!event.payload && typeof event.payload === 'object';
}

function loadClaudeRuntimeHistory(): ClaudeRuntimeEvent[] {
  try {
    if (!fs.existsSync(CLAUDE_EVENT_JOURNAL_PATH)) return [];
    const events = fs.readFileSync(CLAUDE_EVENT_JOURNAL_PATH, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line) => {
      try { const parsed: unknown = JSON.parse(line); return isClaudeRuntimeEvent(parsed) ? [parsed] : []; } catch { return []; }
    });
    return reconcileClaudeRuntimeHistory(events.slice(-CODEX_EVENT_HISTORY_LIMIT));
  } catch { return []; }
}

function persistCodexRuntimeEvent(event: CodexRuntimeEvent) {
  try {
    fs.mkdirSync(path.dirname(CODEX_EVENT_JOURNAL_PATH), { recursive: true });
    fs.appendFileSync(CODEX_EVENT_JOURNAL_PATH, `${JSON.stringify(event)}\n`, 'utf8');
    if (fs.statSync(CODEX_EVENT_JOURNAL_PATH).size > CODEX_EVENT_JOURNAL_LIMIT_BYTES) {
      const compacted = codexEventsHistory.map((item) => JSON.stringify(item)).join('\n') + '\n';
      fs.writeFileSync(CODEX_EVENT_JOURNAL_PATH, compacted, 'utf8');
    }
  } catch {
    // Telemetry persistence is best-effort; the live gateway must remain available.
  }
}

function persistClaudeRuntimeEvent(event: ClaudeRuntimeEvent) {
  try {
    fs.mkdirSync(path.dirname(CLAUDE_EVENT_JOURNAL_PATH), { recursive: true });
    fs.appendFileSync(CLAUDE_EVENT_JOURNAL_PATH, `${JSON.stringify(event)}\n`, 'utf8');
    if (fs.statSync(CLAUDE_EVENT_JOURNAL_PATH).size > CODEX_EVENT_JOURNAL_LIMIT_BYTES) fs.writeFileSync(CLAUDE_EVENT_JOURNAL_PATH, `${claudeEventsHistory.map((item) => JSON.stringify(item)).join('\n')}\n`, 'utf8');
  } catch {
    // 观测持久化失败不能阻断 Claude Code。
  }
}

function registerLocalWebSocketClient(client: WebSocket) {
  localWebSocketClients.add(client);
  client.on('close', () => localWebSocketClients.delete(client));
  client.on('error', () => localWebSocketClients.delete(client));

  const socket = (client as WebSocket & { _socket?: { remoteAddress?: string } })._socket;
  if (isLoopbackAddress(socket?.remoteAddress)) {
    for (const event of codexEventsHistory) {
      client.send(JSON.stringify({ type: 'codex_runtime', payload: event }));
    }
    for (const event of claudeEventsHistory) client.send(JSON.stringify({ type: 'claude_runtime', payload: event }));
  }
}

function broadcast(msg: unknown) {
  const payload = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function broadcastLocal(msg: unknown) {
  const payload = JSON.stringify(msg);
  localWebSocketClients.forEach((client) => {
    const socket = (client as WebSocket & { _socket?: { remoteAddress?: string } })._socket;
    if (client.readyState === WebSocket.OPEN && isLoopbackAddress(socket?.remoteAddress)) {
      client.send(payload);
    }
  });
}

// Check if .claude/settings.json exists
function checkClaudeHooksConfigured() {
  const settingsPath = path.join(process.cwd(), '.claude', 'settings.json');
  try {
    return fs.existsSync(settingsPath);
  } catch {
    return false;
  }
}

// Get real system & git telemetry
function getRealSystemStatus() {
  let gitBranch = 'main';
  let gitStatus = '';
  let gitRecentCommit = '';
  let gitDiff = '';
  let modifiedFiles: string[] = [];

  try {
    gitBranch = child_process.execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { encoding: 'utf-8', timeout: 2000 }).trim();
    gitStatus = child_process.execSync('git status --porcelain 2>/dev/null', { encoding: 'utf-8', timeout: 2000 }).trim();
    gitRecentCommit = child_process.execSync('git log -1 --pretty=format:"%h - %an: %s (%cr)" 2>/dev/null', { encoding: 'utf-8', timeout: 2000 }).trim();
    gitDiff = child_process.execSync('git diff -U2 HEAD 2>/dev/null || git diff -U2 2>/dev/null', { encoding: 'utf-8', timeout: 3000 }).trim().slice(0, 3000);
    if (gitStatus) {
      modifiedFiles = gitStatus.split('\n').map(l => l.trim().substring(3)).filter(Boolean);
    }
  } catch {}

  return {
    isReal: true,
    cwd: process.cwd(),
    hostname: os.hostname(),
    platform: `${os.type()} ${os.arch()}`,
    gitBranch: gitBranch || 'main',
    gitStatus,
    gitDiff,
    modifiedFiles,
    gitRecentCommit: gitRecentCommit || 'Initial commit',
    nodeVersion: process.version,
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptimeSec: Math.round(process.uptime()),
    activeClientsCount: wss.clients.size,
    totalRealEvents: realEventsHistory.length,
    totalCodexEvents: codexEventsHistory.length,
    totalClaudeEvents: claudeEventsHistory.length,
    codexHookPort: CODEX_HOOK_PORT,
    codexHookGatewayState,
    claudeHookPort: CLAUDE_HOOK_PORT,
    claudeHookGatewayState,
    codexAppServerState,
    hasClaudeHooks: checkClaudeHooksConfigured(),
    timestamp: new Date().toISOString(),
  };
}

// Real system status API endpoint
app.get('/api/real/status', (req, res) => {
  res.json(getRealSystemStatus());
});

// Real Git Diff API endpoint
app.get('/api/real/diff', (req, res) => {
  try {
    const diff = child_process.execSync('git diff -U2 HEAD 2>/dev/null || git diff -U2 2>/dev/null', { encoding: 'utf-8', timeout: 3000 });
    res.json({ diff: diff || '(Working tree clean - no uncommitted changes)' });
  } catch (err: any) {
    res.json({ diff: `Unable to read git diff: ${err.message}` });
  }
});

// Execute real shell command endpoint
app.post('/api/real/exec', (req, res) => {
  const command = (req.body?.command || '').trim();
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  // Prevent destructive commands on root
  const forbidden = ['rm -rf /', 'mkfs', ':(){ :|:& };:'];
  if (forbidden.some(f => command.includes(f))) {
    return res.status(403).json({ error: 'Command prohibited by safety policy' });
  }

  const startTime = Date.now();
  console.log(`\x1b[1;33m[REAL CLI EXEC]\x1b[0m ${command}`);

  child_process.exec(
    command,
    { cwd: process.cwd(), timeout: 15000, maxBuffer: 1024 * 1024 },
    (error, stdout, stderr) => {
      const durationMs = Date.now() - startTime;
      const exitCode = error ? (error.code || 1) : 0;
      const output = stdout || stderr || (exitCode === 0 ? '(Done with exit code 0)' : `(Exited with code ${exitCode})`);

      // Broadcast tool execution event to all connected HUD clients
      broadcast({
        type: 'exec_result',
        payload: {
          command,
          stdout,
          stderr,
          output,
          exitCode,
          durationMs,
          timestamp: new Date().toTimeString().split(' ')[0],
        },
      });

      res.json({
        command,
        stdout,
        stderr,
        output,
        exitCode,
        durationMs,
      });
    }
  );
});

// One-click setup Claude Code settings.json hooks in current repo
app.post('/api/real/setup-claude-hooks', (req, res) => {
  try {
    if (!isLoopbackAddress(req.socket.remoteAddress)) return res.status(403).json({ error: 'Claude settings are restricted to localhost' });
    const claudeDir = path.join(process.cwd(), '.claude');
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }
    const settingsPath = path.join(claudeDir, 'settings.json');
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(settingsPath)) {
      try { existing = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
      catch { return res.status(409).json({ error: 'Existing .claude/settings.json is invalid JSON; it was not changed' }); }
    }
    const settingsContent = mergeClaudeRuntimeSettings(existing, path.join('.claude', 'hooks', 'claude-runtime-hook.mjs'), `http://127.0.0.1:${CLAUDE_HOOK_PORT}/hook/claude`);
    fs.writeFileSync(settingsPath, `${JSON.stringify(settingsContent, null, 2)}\n`, 'utf-8');
    console.log(`\x1b[1;32m[HOOKS INJECTED]\x1b[0m Created ${settingsPath}`);

    // Broadcast update
    broadcast({
      type: 'claude_hooks_configured',
      payload: { path: settingsPath, timestamp: new Date().toISOString() },
    });

    res.json({
      success: true,
      message: 'Claude Code hooks successfully injected into .claude/settings.json',
      settingsPath,
      settings: settingsContent,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to write .claude/settings.json: ${err.message}` });
  }
});

// WebSocket message handler
wss.on('connection', (ws) => {
  registerLocalWebSocketClient(ws);
  // Immediately send real initial status to client upon connection
  ws.send(JSON.stringify({
    type: 'system_status',
    payload: getRealSystemStatus(),
  }));

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'hitl_resolution') {
        const resolver = pendingApprovals.get(data.requestId);
        if (resolver) {
          pendingApprovals.delete(data.requestId);
          resolver({ action: data.action || 'approve', prompt: data.prompt });
        }
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      } else if (data.type === 'request_system_status') {
        ws.send(JSON.stringify({ type: 'system_status', payload: getRealSystemStatus() }));
      }
    } catch {}
  });
});

// Reusable PreToolUse Hook Handler
function handlePreHook(payload: any, res: any) {
  const toolName = String(
    payload.tool_name || payload.tool || payload.name || 'UnknownTool'
  );
  const input = payload.tool_input || payload.args || payload.parameters || {};
  const sessionId = payload.session_id || 'claude-session';
  const argsStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2);

  // Extract real file path and real diff
  const realFilePath =
    input.file_path || input.path || input.file || (input.command ? `Bash: ${input.command}` : 'src/auth/oauth2.ts');
  const oldCode = input.old_string || input.oldContent || '// Current original code';
  const newCode = input.new_string || input.newContent || input.content || argsStr;

  // Check sensitive triggers against real arguments and real file path
  const isSensitive = SENSITIVE_PATTERNS.some(
    (pat) => realFilePath.includes(pat) || argsStr.includes(pat)
  );

  const reqId = 'req-' + Math.random().toString(36).substring(2, 8);
  const timestamp = new Date().toTimeString().split(' ')[0];

  const eventRecord = {
    id: reqId,
    timestamp,
    sessionId,
    toolName,
    realFilePath,
    argsStr,
    isSensitive,
  };
  realEventsHistory.push(eventRecord);
  if (realEventsHistory.length > 100) realEventsHistory.shift();

  if (isSensitive) {
    console.log(`\x1b[1;31m[GATEWAY BLOCKED]\x1b[0m High-risk tool call intercepted: ${toolName} touching ${realFilePath}`);

    broadcast({
      type: 'hitl_blocked',
      payload: {
        id: reqId,
        timestamp,
        sessionId,
        tool: toolName,
        args: argsStr,
        targetPath: realFilePath,
        riskScore: 96.4,
        cveOrRule: 'OWASP-2026-A01: Sensitive Credential Mutation',
        summary: `Claude Code 正在执行 ${toolName}，试图修改核心资产: ${realFilePath}`,
        diffSnippet: {
          filePath: realFilePath,
          oldCode,
          newCode,
        },
      },
    });

    const timeout = setTimeout(() => {
      pendingApprovals.delete(reqId);
      res.status(408).send('Approval timeout (120s limit exceeded)');
    }, 120000);

    pendingApprovals.set(reqId, (decision) => {
      clearTimeout(timeout);
      if (decision.action === 'rollback') {
        res.status(403).json({ error: 'Rejected by security supervisor via Web Control Plane' });
      } else {
        res.status(200).json({ status: 'approved', injectedPrompt: decision.prompt });
      }
    });
    return;
  }

  // Nominal tool call: broadcast real event immediately to Web HUD
  console.log(`\x1b[1;32m[REAL TOOL]\x1b[0m ${toolName} -> ${realFilePath}`);
  broadcast({
    type: 'tool_call',
    payload: {
      name: toolName,
      args: typeof input === 'string' ? input : (input.command || realFilePath),
      status: 'executing',
      timestamp,
      sessionId,
      diffSnippet: (input.old_string || input.new_string) ? {
        filePath: realFilePath,
        oldCode,
        newCode,
      } : undefined,
    },
  });

  res.status(200).json({ status: 'proceed', dispatched: true, tool: toolName });
}

// Real Claude Code PreToolUse hook parser
app.post('/hook/pre', (req, res) => {
  handlePreHook(req.body || {}, res);
});

// Real Claude Code PostToolUse hook
app.post('/hook/post', (req, res) => {
  const payload = req.body || {};
  const toolName = String(payload.tool_name || payload.tool || payload.name || 'UnknownTool');
  const timestamp = new Date().toTimeString().split(' ')[0];

  broadcast({
    type: 'telemetry',
    payload: {
      ...payload,
      toolName,
      timestamp,
    },
  });

  res.status(200).json({ status: 'ok' });
});

app.post('/hook/codex', (req, res) => {
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    return res.status(403).json({ error: 'Codex telemetry is restricted to localhost' });
  }
  const event = normalizeCodexHookPayload(req.body);
  if (!event) return res.status(400).json({ error: 'Invalid Codex hook payload' });

  const correlatedEvent = correlateCodexRuntimeEvent(event, codexEventsHistory);
  codexEventsHistory.push(correlatedEvent);
  if (codexEventsHistory.length > CODEX_EVENT_HISTORY_LIMIT) codexEventsHistory.shift();
  persistCodexRuntimeEvent(correlatedEvent);
  broadcastLocal({ type: 'codex_runtime', payload: correlatedEvent });
  res.status(202).json({ status: 'accepted' });
});

app.post('/hook/claude', (req, res) => {
  if (!isLoopbackAddress(req.socket.remoteAddress)) return res.status(403).json({ error: 'Claude telemetry is restricted to localhost' });
  const event = normalizeClaudeHookPayload(req.body);
  if (!event) return res.status(400).json({ error: 'Invalid Claude hook payload' });
  const reconciled = reconcileClaudeRuntimeHistory([...claudeEventsHistory, event]);
  const correlatedEvent = reconciled.at(-1)!;
  claudeEventsHistory = reconciled;
  if (claudeEventsHistory.length > CODEX_EVENT_HISTORY_LIMIT) claudeEventsHistory.shift();
  persistClaudeRuntimeEvent(correlatedEvent);
  broadcastLocal({ type: 'claude_runtime', payload: correlatedEvent });
  res.status(202).json({ status: 'accepted' });
});

app.get('/api/real/codex-events', (req, res) => {
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    return res.status(403).json({ error: 'Codex telemetry is restricted to localhost' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ events: codexEventsHistory, retained: codexEventsHistory.length, journaled: true });
});

app.get('/api/real/claude-events', (req, res) => {
  if (!isLoopbackAddress(req.socket.remoteAddress)) return res.status(403).json({ error: 'Claude telemetry is restricted to localhost' });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ events: claudeEventsHistory, retained: claudeEventsHistory.length, journaled: true });
});

function isSameOriginLocalRequest(req: express.Request) {
  if (!isLoopbackAddress(req.socket.remoteAddress)) return false;
  return isTrustedClaudeTelemetryOrigin({ host: req.get('host'), origin: req.get('origin'), port: OBSERVATORY_PORT });
}

app.get('/api/real/claude-telemetry', (req, res) => {
  if (!isSameOriginLocalRequest(req)) return res.status(403).json({ error: 'Claude telemetry is restricted to the local observatory origin' });
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.slice(0, 160) : '';
  const turnId = typeof req.query.turnId === 'string' ? req.query.turnId.slice(0, 160) : '';
  let telemetry = findClaudeTelemetry(readClaudeDesktopTelemetry(), sessionId, turnId, claudeEventsHistory);
  const cwd = findClaudeSessionCwd(sessionId, claudeEventsHistory);
  if (!telemetry && cwd && turnId && claudeEventsHistory.some(event => event.sessionId === sessionId && event.turnId === turnId)) telemetry = { sessionId, turnId };
  if (telemetry) telemetry.memoryMetadata = cwd ? readClaudeProjectMemoryMetadata({ cwd }) : { status: 'unavailable', fileCount: 0, totalBytes: 0, latestModifiedAt: null };
  res.setHeader('Cache-Control', 'no-store');
  res.json({ telemetry });
});

app.get('/api/real/claude-desktop-telemetry', (req, res) => {
  if (!isSameOriginLocalRequest(req)) return res.status(403).json({ error: 'Claude telemetry is restricted to the local observatory origin' });
  const snapshot = readClaudeDesktopOnlyTelemetry();
  res.setHeader('Cache-Control', 'no-store');
  res.json(snapshot);
});

app.get('/api/real/codex-rollout', async (req, res) => {
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    return res.status(403).json({ error: 'Codex telemetry is restricted to localhost' });
  }
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
  const turnId = typeof req.query.turnId === 'string' ? req.query.turnId : undefined;
  if (!sessionId || sessionId.length > 128 || (turnId && turnId.length > 128)) {
    return res.status(400).json({ error: 'A valid sessionId is required' });
  }
  try {
    const telemetry = await readCodexRolloutTelemetry(sessionId, turnId);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ telemetry });
  } catch {
    res.status(200).json({ telemetry: null });
  }
});

app.get('/api/real/codex-skill', (req, res) => {
  const origin = req.get('origin');
  const sameOrigin = !origin || (() => {
    try { return new URL(origin).host === req.get('host'); } catch { return false; }
  })();
  if (!isLoopbackAddress(req.socket.remoteAddress) || !sameOrigin) {
    return res.status(403).json({ error: 'Codex skill files are restricted to localhost' });
  }
  const name = typeof req.query.name === 'string' ? req.query.name : '';
  const cwd = typeof req.query.cwd === 'string' && req.query.cwd.length <= 1024 && path.isAbsolute(req.query.cwd)
    ? req.query.cwd
    : process.cwd();
  if (!name || name.length > 120) return res.status(400).json({ error: 'A valid skill name is required' });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ sources: readCodexSkillSources(name, cwd) });
});

app.delete('/api/real/codex-events', (req, res) => {
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    return res.status(403).json({ error: 'Codex telemetry is restricted to localhost' });
  }
  codexEventsHistory = [];
  try {
    fs.rmSync(CODEX_EVENT_JOURNAL_PATH, { force: true });
  } catch {}
  codexAppServerMonitor?.checkpoint();
  broadcastLocal({ type: 'codex_runtime_cleared', payload: { timestamp: new Date().toISOString() } });
  res.sendStatus(204);
});

app.delete('/api/real/claude-events', (req, res) => {
  if (!isLoopbackAddress(req.socket.remoteAddress)) return res.status(403).json({ error: 'Claude telemetry is restricted to localhost' });
  claudeEventsHistory = [];
  try { fs.rmSync(CLAUDE_EVENT_JOURNAL_PATH, { force: true }); } catch {}
  broadcastLocal({ type: 'claude_runtime_cleared', payload: { timestamp: new Date().toISOString() } });
  res.sendStatus(204);
});

// Test Endpoint for real local trigger
app.post('/api/real/test-event', (req, res) => {
  const isHighRisk = req.body?.risk === 'high';

  const simulatedPayload = isHighRisk ? {
    tool_name: 'FileEdit',
    tool_input: {
      file_path: 'src/auth/oauth2.ts',
      old_string: 'const token = await legacyVerify(req.query.code);',
      new_string: 'const token = await secureOauthExchange(req.query.code, state);',
    }
  } : {
    tool_name: 'Bash',
    tool_input: {
      command: 'git status --porcelain',
    }
  };

  handlePreHook(simulatedPayload, res);
});

// Mount Vite or serve static dist
async function start() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(OBSERVATORY_PORT, '0.0.0.0', () => {
    console.log(`\x1b[1;36m⚡ AGENT MATRIX Server running on http://0.0.0.0:${OBSERVATORY_PORT}\x1b[0m`);
  });

  // Keep the existing Claude gateway port and use a separate Codex hook port.
  const startLocalGateway = (port: number) => {
    const gatewayServer = http.createServer(app);
    const gatewayWss = new WebSocketServer({ server: gatewayServer, path: '/ws' });
    gatewayWss.on('connection', (ws) => {
      registerLocalWebSocketClient(ws);
      ws.send(JSON.stringify({ type: 'system_status', payload: getRealSystemStatus() }));
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'hitl_resolution') {
            const resolver = pendingApprovals.get(data.requestId);
            if (resolver) {
              pendingApprovals.delete(data.requestId);
              resolver({ action: data.action || 'approve', prompt: data.prompt });
            }
          } else if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          } else if (data.type === 'request_system_status') {
            ws.send(JSON.stringify({ type: 'system_status', payload: getRealSystemStatus() }));
          }
        } catch {}
      });
    });

    gatewayServer.listen(port, '127.0.0.1', () => {
      if (port === CODEX_HOOK_PORT) codexHookGatewayState = 'listening';
      if (port === CLAUDE_HOOK_PORT) claudeHookGatewayState = 'listening';
      console.log(`\x1b[1;32m⚡ Embedded Agent Runtime Gateway listening on http://127.0.0.1:${port}\x1b[0m`);
    });
    gatewayWss.on('error', () => {
      // The primary HTTP server remains available when an optional gateway port is occupied.
    });
    gatewayServer.on('error', () => {
      if (port === CODEX_HOOK_PORT) codexHookGatewayState = 'offline';
      if (port === CLAUDE_HOOK_PORT) claudeHookGatewayState = 'offline';
      // Another local integration may already own this optional port.
    });
  };

  try {
    [...new Set([CLAUDE_HOOK_PORT, CODEX_HOOK_PORT])].forEach(startLocalGateway);
  } catch {}

  if (process.env.CODEX_APP_SERVER_MONITOR !== '0') {
    codexAppServerMonitor = new CodexAppServerMonitor(
      process.cwd(),
      (event) => {
        if (codexEventsHistory.some((current) => current.eventId === event.eventId)) return;
        const normalized = correlateCodexRuntimeEvent(event, codexEventsHistory);
        codexEventsHistory.push(normalized);
        if (codexEventsHistory.length > CODEX_EVENT_HISTORY_LIMIT) codexEventsHistory.shift();
        persistCodexRuntimeEvent(normalized);
        broadcastLocal({ type: 'codex_runtime', payload: normalized });
      },
      (state) => {
        codexAppServerState = state;
        broadcast({ type: 'system_status', payload: getRealSystemStatus() });
      },
      2500,
      CODEX_APP_SERVER_STATE_PATH,
    );
    codexAppServerMonitor.seed(codexEventsHistory);
    codexAppServerMonitor.start();
  }

  process.on('exit', () => codexAppServerMonitor?.stop());

  // Periodic real status broadcast every 4 seconds to all connected clients
  setInterval(() => {
    if (wss.clients.size > 0) {
      try {
        broadcast({
          type: 'system_status',
          payload: getRealSystemStatus(),
        });
      } catch {}
    }
  }, 4000);
}

start();
