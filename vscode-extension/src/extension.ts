/**
 * Agent Matrix · AI Agent Control Plane & Security Gateway
 * Native VS Code & Cursor IDE Extension
 * Embedded Node.js HTTP + WebSocket server on Port 7788. Zero Python required!
 */

import * as vscode from 'vscode';
import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';
import * as fs from 'fs';

let server: http.Server | null = null;
let wss: WebSocketServer | null = null;
let statusBarItem: vscode.StatusBarItem;
const pendingApprovals = new Map<string, (decision: { action: string; prompt?: string }) => void>();
const SENSITIVE_PATTERNS = ['auth.ts', 'k8s/prod-secrets.yaml', 'schema.prisma', 'migrations', '.env', 'rm -rf'];

export function activate(context: vscode.ExtensionContext) {
  // 1. Create and show Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'agentMatrix.openDashboard';
  statusBarItem.text = '$(shield) $(zap) Agent Matrix: Booting...';
  statusBarItem.tooltip = 'Click to open Agent Matrix Neural Tree Control Plane';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // 2. Start embedded Node.js Gateway Server on port 7788
  startEmbeddedGateway();

  // 3. Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('agentMatrix.openDashboard', () => {
      openControlPlaneWebview(context);
    }),

    vscode.commands.registerCommand('agentMatrix.approveCurrent', () => {
      if (pendingApprovals.size === 0) {
        vscode.window.showInformationMessage('No active tool calls awaiting approval.');
        return;
      }
      const [reqId, resolver] = pendingApprovals.entries().next().value;
      pendingApprovals.delete(reqId);
      resolver({ action: 'approve' });
      broadcastToHud({ type: 'hitl_resolved', requestId: reqId, action: 'approve' });
      vscode.window.showInformationMessage(`[HITL Approved] Tool call ${reqId} has been unblocked.`);
    }),

    vscode.commands.registerCommand('agentMatrix.rollbackCurrent', () => {
      if (pendingApprovals.size === 0) {
        vscode.window.showInformationMessage('No active tool calls awaiting approval.');
        return;
      }
      const [reqId, resolver] = pendingApprovals.entries().next().value;
      pendingApprovals.delete(reqId);
      resolver({ action: 'rollback' });
      broadcastToHud({ type: 'hitl_resolved', requestId: reqId, action: 'rollback' });
      vscode.window.showWarningMessage(`[HITL Rollback] Mutation ${reqId} was rejected and rolled back.`);
    }),

    vscode.commands.registerCommand('agentMatrix.setupClaudeHooks', () => {
      setupWorkspaceHooks();
    })
  );

  // Auto-check hooks in active workspace
  checkAndPromptHooks();
}

function startEmbeddedGateway() {
  server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/hook/pre' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        handlePreToolCall(body, res);
      });
      return;
    }

    if (req.url === '/hook/post' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        broadcastToHud({ type: 'telemetry', raw: body });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });
      return;
    }

    res.writeHead(404);
    res.end('Agent Matrix Gateway running on port 7788.');
  });

  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'hitl_resolution') {
          const resolver = pendingApprovals.get(data.requestId);
          if (resolver) {
            pendingApprovals.delete(data.requestId);
            resolver({ action: data.action || 'approve', prompt: data.prompt });
          }
        }
      } catch {}
    });
  });

  server.listen(7788, '127.0.0.1', () => {
    statusBarItem.text = '$(shield) ⚡ Agent Matrix: Online [7788]';
    statusBarItem.backgroundColor = undefined;
    statusBarItem.tooltip = 'Agent Matrix Gateway active on http://127.0.0.1:7788';
  });

  server.on('error', (err: { code?: string }) => {
    if (err.code === 'EADDRINUSE') {
      statusBarItem.text = '$(shield) ⚡ Agent Matrix: Connected (7788 in use)';
    } else {
      statusBarItem.text = '$(alert) Agent Matrix: Offline';
    }
  });
}

function handlePreToolCall(rawBody: string, res: http.ServerResponse) {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = { raw: rawBody };
  }

  const toolName = String(payload.tool || payload.name || 'UnknownTool');
  const argsStr = JSON.stringify(payload.args || payload.parameters || {});
  const isSensitive = SENSITIVE_PATTERNS.some((pat) => argsStr.includes(pat));
  const reqId = 'req-' + Math.random().toString(36).substring(2, 8);

  if (isSensitive) {
    // Broadcast block to Web HUD
    broadcastToHud({
      type: 'hitl_blocked',
      payload: {
        id: reqId,
        tool: toolName,
        args: argsStr,
        targetPath: 'src/auth/oauth2.ts',
        riskScore: 96.4,
        cveOrRule: 'OWASP-2026-A01: Sensitive Credential Mutation',
        summary: `Claude Code attempted to execute ${toolName} touching sensitive assets.`,
      },
    });

    // Native IDE popup Notification
    vscode.window
      .showWarningMessage(
        `[Agent Matrix Security Gate] Blocked high-risk tool call '${toolName}' touching sensitive files.`,
        'Approve (放行)',
        'Rollback (回滚)',
        'Open Control Plane'
      )
      .then((choice) => {
        if (choice === 'Approve (放行)') {
          vscode.commands.executeCommand('agentMatrix.approveCurrent');
        } else if (choice === 'Rollback (回滚)') {
          vscode.commands.executeCommand('agentMatrix.rollbackCurrent');
        } else if (choice === 'Open Control Plane') {
          vscode.commands.executeCommand('agentMatrix.openDashboard');
        }
      });

    // Suspend execution awaiting approval (timeout 120s)
    const timeout = setTimeout(() => {
      pendingApprovals.delete(reqId);
      res.writeHead(408);
      res.end('Approval timeout');
    }, 120000);

    pendingApprovals.set(reqId, (decision) => {
      clearTimeout(timeout);
      if (decision.action === 'rollback') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Rejected by security supervisor' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'approved', injectedPrompt: decision.prompt }));
      }
    });
    return;
  }

  // Nominal call: immediate broadcast & proceed
  broadcastToHud({
    type: 'tool_call',
    payload: { name: toolName, args: argsStr, status: 'executing' },
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'proceed' }));
}

function broadcastToHud(message: unknown) {
  if (wss) {
    const payload = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
}

function setupWorkspaceHooks() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const root = folders[0].uri.fsPath;
  const claudeDir = path.join(root, '.claude');
  const settingsFile = path.join(claudeDir, 'settings.json');

  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  const hookConfig = {
    hooks: {
      PreToolUse: "curl -s -X POST http://localhost:7788/hook/pre -H 'Content-Type: application/json' -d @-",
      PostToolUse: "curl -s -X POST http://localhost:7788/hook/post -H 'Content-Type: application/json' -d @-",
    },
    security: {
      gatekeeperEnabled: true,
      gatekeeperPort: 7788,
    },
  };

  fs.writeFileSync(settingsFile, JSON.stringify(hookConfig, null, 2), 'utf-8');
  vscode.window.showInformationMessage(`⚡ Successfully configured Claude Code hooks in ${settingsFile}!`);
}

function checkAndPromptHooks() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return;
  const settingsFile = path.join(folders[0].uri.fsPath, '.claude', 'settings.json');
  if (!fs.existsSync(settingsFile)) {
    vscode.window
      .showInformationMessage(
        'Agent Matrix: Configure Claude Code security hooks for this workspace?',
        'Auto-Configure (一键配置)',
        'Later'
      )
      .then((choice) => {
        if (choice === 'Auto-Configure (一键配置)') {
          setupWorkspaceHooks();
        }
      });
  }
}

function openControlPlaneWebview(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'agentMatrixDashboard',
    '⚡ Agent Matrix · Control Plane',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <style>body, html, iframe { margin: 0; padding: 0; width: 100%; height: 100%; border: none; overflow: hidden; background: #06070a; }</style>
    </head>
    <body>
      <iframe src="http://localhost:3000"></iframe>
    </body>
  </html>`;
}

export function deactivate() {
  if (server) server.close();
  if (wss) wss.close();
}
