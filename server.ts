/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const SENSITIVE_PATTERNS = ['auth.ts', 'k8s/prod-secrets.yaml', 'schema.prisma', 'migrations', '.env', 'rm -rf'];
const pendingApprovals = new Map<string, (decision: { action: string; prompt?: string }) => void>();

function broadcast(msg: unknown) {
  const payload = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// WebSocket message handler
wss.on('connection', (ws) => {
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

// Claude Code / Codex PreToolUse hook
app.post('/hook/pre', (req, res) => {
  const payload = req.body || {};
  const toolName = String(payload.tool || payload.name || 'UnknownTool');
  const argsStr = JSON.stringify(payload.args || payload.parameters || {});
  const isSensitive = SENSITIVE_PATTERNS.some((pat) => argsStr.includes(pat));
  const reqId = 'req-' + Math.random().toString(36).substring(2, 8);

  if (isSensitive) {
    broadcast({
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

    const timeout = setTimeout(() => {
      pendingApprovals.delete(reqId);
      res.status(408).send('Approval timeout');
    }, 120000);

    pendingApprovals.set(reqId, (decision) => {
      clearTimeout(timeout);
      if (decision.action === 'rollback') {
        res.status(403).json({ error: 'Rejected by security supervisor' });
      } else {
        res.status(200).json({ status: 'approved', injectedPrompt: decision.prompt });
      }
    });
    return;
  }

  broadcast({
    type: 'tool_call',
    payload: { name: toolName, args: argsStr, status: 'executing' },
  });

  res.status(200).json({ status: 'proceed' });
});

// Claude Code PostToolUse hook
app.post('/hook/post', (req, res) => {
  broadcast({
    type: 'telemetry',
    payload: req.body || {},
  });
  res.status(200).json({ status: 'ok' });
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

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ AGENT MATRIX Server running on http://0.0.0.0:${PORT}`);
  });

  // Secondary standalone listener on Port 7788 for native hook compatibility
  try {
    const gatewayServer = http.createServer(app);
    const gatewayWss = new WebSocketServer({ server: gatewayServer, path: '/ws' });
    gatewayWss.on('connection', (ws) => {
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

    gatewayServer.listen(7788, '127.0.0.1', () => {
      console.log(`⚡ Embedded Agent Security Gateway listening on http://127.0.0.1:7788`);
    });
    gatewayWss.on('error', () => {
      // Ignore if port 7788 is already bound
    });
    gatewayServer.on('error', () => {
      // If 7788 is already bound (e.g. by VS Code extension), ignore
    });
  } catch {}
}

start();
