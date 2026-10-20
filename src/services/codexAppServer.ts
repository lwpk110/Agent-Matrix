import { createHash } from 'node:crypto';
import { spawn, ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import { CodexRuntimeEvent, redactRuntimeText } from './codexRuntime';

type JsonRecord = Record<string, unknown>;
type AppTurn = { id: string; startedAt?: number | null; items?: JsonRecord[] };
type AppThread = { id: string; updatedAt: number; cwd?: string; turns?: AppTurn[] };
type MonitorState = 'starting' | 'listening' | 'offline';

const REDACTED_FIELDS = /(?:api.?key|access.?token|refresh.?token|id.?token|password|passwd|secret|authorization|cookie|credential|private.?key)/i;
const MUTABLE_ITEM_EVENTS = new Set(['AppServerMcpToolCall', 'AppServerDynamicToolCall', 'AppServerCommandExecution']);

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function safeValue(value: unknown, depth = 0, stringLimit = 1200): unknown {
  if (depth >= 4) return '[TRUNCATED]';
  if (typeof value === 'string') return redactRuntimeText(value).slice(0, stringLimit);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeValue(item, depth + 1, stringLimit));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as JsonRecord)
    .filter(([key]) => !/transcript_path|rollout_path|(?:^|_)path$/i.test(key))
    .slice(0, 40)
    .map(([key, item]) => [key, REDACTED_FIELDS.test(key) ? '[REDACTED]' : safeValue(item, depth + 1, stringLimit)]));
}

function eventId(threadId: string, turnId: string, itemId: string, suffix = '') {
  return `app-${createHash('sha256').update(`${threadId}:${turnId}:${itemId}:${suffix}`).digest('hex').slice(0, 32)}`;
}

function appEvent(args: {
  thread: AppThread;
  turn: AppTurn;
  item: JsonRecord;
  itemIndex: number;
  name: string;
  phase: CodexRuntimeEvent['phase'];
  toolName?: string;
  payload?: JsonRecord;
  suffix?: string;
}): CodexRuntimeEvent {
  const turn = args.turn;
  const timestampPrecision = turn.startedAt ? 'turn-start' : 'observed';
  const timestamp = turn.startedAt ? new Date(turn.startedAt * 1000).toISOString() : new Date().toISOString();
  const sanitized = safeValue(args.payload || {}, 0, args.name === 'UserPromptSubmit' ? 4000 : 1200) as JsonRecord;
  const snapshot = MUTABLE_ITEM_EVENTS.has(args.name)
    ? createHash('sha256').update(JSON.stringify(sanitized)).digest('hex').slice(0, 16)
    : args.suffix;
  return {
    provider: 'codex',
    source: 'codex-app-server',
    eventId: eventId(args.thread.id, turn.id, String(args.item.id || args.itemIndex), snapshot),
    hookEventName: args.name,
    sessionId: args.thread.id,
    turnId: turn.id,
    toolUseId: typeof args.item.id === 'string' ? args.item.id : undefined,
    cwd: args.thread.cwd,
    phase: args.phase,
    hasToolResponse: args.phase === 'completed',
    toolInputKeys: Object.keys(record(sanitized.arguments)).slice(0, 24),
    timestamp,
    toolName: args.toolName ? redactRuntimeText(args.toolName).slice(0, 160) : undefined,
    payload: { ...sanitized, itemIndex: args.itemIndex, timestampPrecision },
  };
}

/** Converts only user-facing runtime evidence; reasoning and hook prompt bodies are excluded. */
export function normalizeCodexAppServerItem(thread: AppThread, turn: NonNullable<AppThread['turns']>[number], item: JsonRecord, itemIndex: number): CodexRuntimeEvent[] {
  const type = item.type;
  const events: CodexRuntimeEvent[] = [];

  if (type === 'userMessage') {
    const content = Array.isArray(item.content) ? item.content.map(record) : [];
    const prompt = content.filter((part) => part.type === 'text' && typeof part.text === 'string').map((part) => part.text as string).join('\n').trim();
    const selectedSkills = content.filter((part) => part.type === 'skill' && typeof part.name === 'string').map((part) => String(part.name).slice(0, 120));
    const nonTextCount = content.filter((part) => part.type !== 'text' && part.type !== 'skill').length;
    events.push(appEvent({ thread, turn, item, itemIndex, name: 'UserPromptSubmit', phase: 'prompt', payload: { prompt: prompt || (nonTextCount ? '[non-text input]' : ''), selectedSkills } }));
    selectedSkills.forEach((name, skillIndex) => events.push(appEvent({ thread, turn, item, itemIndex, name: 'SkillActivated', phase: 'lifecycle', toolName: name, payload: { skillName: name }, suffix: `skill-${skillIndex}` })));
    return events;
  }

  if (type === 'webSearch') {
    return [appEvent({ thread, turn, item, itemIndex, name: 'AppServerWebSearch', phase: 'completed', toolName: 'WebSearch', payload: { query: item.query, actionType: record(item.action).type, resultCount: Array.isArray(item.results) ? item.results.length : 0 } })];
  }

  if (type === 'mcpToolCall') {
    const status = String(item.status || 'unknown');
    return [appEvent({ thread, turn, item, itemIndex, name: 'AppServerMcpToolCall', phase: /progress|in.?progress|running/i.test(status) ? 'started' : 'completed', toolName: `${String(item.server || 'MCP')}/${String(item.tool || 'tool')}`, payload: { server: item.server, tool: item.tool, status, arguments: item.arguments, durationMs: item.durationMs, readOnlyHint: item.readOnlyHint } })];
  }

  if (type === 'dynamicToolCall') {
    const status = String(item.status || 'unknown');
    const namespace = typeof item.namespace === 'string' ? item.namespace : '';
    const toolName = `${namespace ? `${namespace}/` : ''}${String(item.tool || 'tool')}`;
    return [appEvent({ thread, turn, item, itemIndex, name: 'AppServerDynamicToolCall', phase: /progress|in.?progress|running/i.test(status) ? 'started' : 'completed', toolName, payload: { namespace, tool: item.tool, status, success: item.success, arguments: item.arguments, durationMs: item.durationMs } })];
  }

  if (type === 'subAgentActivity') {
    return [appEvent({ thread, turn, item, itemIndex, name: 'AppServerSubAgentActivity', phase: 'lifecycle', toolName: 'Subagent', payload: { kind: item.kind, agentThreadId: item.agentThreadId } })];
  }

  if (type === 'plan') {
    return [appEvent({ thread, turn, item, itemIndex, name: 'AppServerPlan', phase: 'lifecycle', payload: { text: item.text } })];
  }

  if (type === 'contextCompaction') {
    return [appEvent({ thread, turn, item, itemIndex, name: 'AppServerContextCompaction', phase: 'lifecycle' })];
  }

  if (type === 'fileChange') {
    const changes = Array.isArray(item.changes) ? item.changes.map(record).map((change) => ({ path: change.path, kind: change.kind })) : [];
    return [appEvent({ thread, turn, item, itemIndex, name: 'AppServerFileChange', phase: 'completed', payload: { status: item.status, changes } })];
  }

  if (type === 'commandExecution') {
    const status = String(item.status || 'unknown');
    return [appEvent({ thread, turn, item, itemIndex, name: 'AppServerCommandExecution', phase: /progress|in.?progress|running/i.test(status) ? 'started' : 'completed', toolName: 'Bash', payload: { command: item.command, status, exitCode: item.exitCode, durationMs: item.durationMs, commandActions: item.commandActions } })];
  }

  if (type === 'agentMessage' && item.phase === 'final_answer' && typeof item.text === 'string') {
    return [appEvent({ thread, turn, item, itemIndex, name: 'AppServerFinalAnswer', phase: 'completed', payload: { text: item.text } })];
  }

  return events;
}

async function reserveLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const listener = createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address();
      if (!address || typeof address === 'string') return listener.close(() => reject(new Error('Could not reserve app-server port')));
      listener.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

export class CodexAppServerMonitor {
  private process: ChildProcess | null = null;
  private socket: WebSocket | null = null;
  private pending = new Map<number, { resolve: (value: JsonRecord) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private threadVersions = new Map<string, number>();
  private seenEventIds = new Set<string>();
  private requestId = 0;
  private running = false;
  private state: MonitorState = 'offline';

  constructor(
    private readonly cwd: string,
    private readonly onEvent: (event: CodexRuntimeEvent) => void,
    private readonly onState: (state: MonitorState) => void = () => {},
    private readonly pollMs = Math.max(1000, Number(process.env.CODEX_APP_SERVER_POLL_MS) || 2500),
    private readonly statePath = path.join(process.cwd(), '.codex', 'runtime-appserver-state.json'),
  ) {
    this.loadCheckpoint();
  }

  getState() { return this.state; }

  start() {
    if (this.running) return;
    this.running = true;
    void this.run();
  }

  stop() {
    this.running = false;
    this.socket?.close();
    this.socket = null;
    this.process?.kill();
    this.process = null;
  }

  /** Restore event deduplication from the persisted runtime journal. */
  seed(events: CodexRuntimeEvent[]) {
    events.filter((event) => event.source === 'codex-app-server').forEach((event) => this.seenEventIds.add(event.eventId));
  }

  checkpoint() {
    try {
      fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
      fs.writeFileSync(this.statePath, JSON.stringify({
        threadVersions: [...this.threadVersions.entries()].slice(-100),
        seenEventIds: [...this.seenEventIds].slice(-5000),
      }), 'utf8');
    } catch {}
  }

  private loadCheckpoint() {
    try {
      const value = JSON.parse(fs.readFileSync(this.statePath, 'utf8')) as { threadVersions?: Array<[string, number]>; seenEventIds?: string[] };
      (value.threadVersions || []).forEach(([id, version]) => this.threadVersions.set(id, version));
      (value.seenEventIds || []).forEach((id) => this.seenEventIds.add(id));
    } catch {}
  }

  private setState(state: MonitorState) {
    if (this.state === state) return;
    this.state = state;
    this.onState(state);
  }

  private async run() {
    while (this.running) {
      try {
        await this.ensureConnected();
        await this.pollThreads();
        this.setState('listening');
      } catch {
        this.setState('offline');
        this.socket?.close();
        this.socket = null;
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollMs));
    }
  }

  private async ensureConnected() {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    this.setState('starting');
    if (!this.process || this.process.exitCode !== null) {
      const port = await reserveLoopbackPort();
      this.process = spawn(process.env.CODEX_CLI_PATH || 'codex', ['app-server', '--listen', `ws://127.0.0.1:${port}`], {
        stdio: 'ignore',
        windowsHide: true,
      });
      this.process.on('exit', () => {
        this.socket?.close();
        this.socket = null;
        this.process = null;
        if (this.running) this.setState('offline');
      });
      this.process.on('error', () => {
        this.process = null;
        this.setState('offline');
      });
      this.process.unref();
      await new Promise((resolve) => setTimeout(resolve, 500));
      this.serverUrl = `ws://127.0.0.1:${port}`;
    }
    if (!this.serverUrl) throw new Error('Codex app-server has no endpoint');
    this.socket = await this.openSocket(this.serverUrl);
    await this.request('initialize', {
      clientInfo: { name: 'agent-matrix-runtime-monitor', title: 'Agent Matrix', version: '0.1.0' },
      capabilities: { experimentalApi: false, requestAttestation: false },
    });
  }

  private serverUrl = '';

  private openSocket(url: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const timeout = setTimeout(() => {
        socket.terminate();
        reject(new Error('Codex app-server connection timed out'));
      }, 8000);
      socket.once('open', () => {
        clearTimeout(timeout);
        socket.on('message', (raw) => this.handleMessage(raw.toString()));
        socket.on('close', () => this.rejectPending(new Error('Codex app-server disconnected')));
        socket.on('error', () => this.rejectPending(new Error('Codex app-server socket failed')));
        resolve(socket);
      });
      socket.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private handleMessage(raw: string) {
    let message: JsonRecord;
    try { message = JSON.parse(raw) as JsonRecord; } catch { return; }
    const id = typeof message.id === 'number' ? message.id : undefined;
    if (id === undefined) return;
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    if (message.error) pending.reject(new Error('Codex app-server request failed'));
    else pending.resolve(record(message.result));
  }

  private rejectPending(error: Error) {
    this.pending.forEach((request) => {
      clearTimeout(request.timer);
      request.reject(error);
    });
    this.pending.clear();
  }

  private request(method: string, params: JsonRecord): Promise<JsonRecord> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Codex app-server is offline'));
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Codex app-server request timed out'));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket!.send(JSON.stringify({ id, method, params }), (error) => {
        if (!error) return;
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  private async pollThreads() {
    const response = await this.request('thread/list', {
      cwd: this.cwd,
      limit: 12,
      sortKey: 'updated_at',
      sortDirection: 'desc',
      useStateDbOnly: true,
    });
    const threads = Array.isArray(response.data) ? response.data.map((item) => record(item) as AppThread) : [];
    for (const thread of threads.sort((a, b) => a.updatedAt - b.updatedAt)) {
      if (!thread.id || this.threadVersions.get(thread.id) === thread.updatedAt) continue;
      const history = await this.request('thread/read', { threadId: thread.id, includeTurns: true });
      const fullThread = record(history.thread) as AppThread;
      for (const turn of fullThread.turns || []) {
        (turn.items || []).forEach((item, index) => {
          for (const event of normalizeCodexAppServerItem(fullThread, turn, item, index)) {
            if (this.seenEventIds.has(event.eventId)) continue;
            this.seenEventIds.add(event.eventId);
            if (this.seenEventIds.size > 5000) this.seenEventIds.delete(this.seenEventIds.values().next().value!);
            this.onEvent(event);
          }
        });
      }
      this.threadVersions.set(thread.id, thread.updatedAt);
      this.checkpoint();
    }
  }
}
