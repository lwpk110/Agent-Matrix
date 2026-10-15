/**
 * Real-time WebSocket Telemetry Bus Client & Real Gateway API Bridge
 * Connects to local server WebSocket (/ws) and 7788 security gateway.
 * Supports Claude Code PreToolUse/PostToolUse hooks and Codex CLI events.
 * Smoothly degrades to simulation mode with background heartbeat probe when offline.
 */

import { WsConnectionState, HitlApprovalRequest, ToolCall, RealSystemStatus } from '../types/matrix';

export type WsEventHandler = (event: {
  type: 'tool_call' | 'hitl_blocked' | 'telemetry' | 'agent_state' | 'pong' | 'system_status' | 'exec_result' | 'claude_hooks_configured';
  payload: unknown;
}) => void;

class WebSocketTelemetryBus {
  private ws: WebSocket | null = null;
  private connectionState: WsConnectionState = 'probing';
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private handlers: Set<WsEventHandler> = new Set();
  private stateListeners: Set<(state: WsConnectionState) => void> = new Set();
  private forceSimulation: boolean = false;
  private retryAttempt: number = 0;

  constructor() {
    this.connect();
  }

  public setForceSimulation(force: boolean) {
    this.forceSimulation = force;
    if (force) {
      if (this.ws) {
        try {
          this.ws.close();
        } catch {}
        this.ws = null;
      }
      this.setState('simulation');
    } else {
      this.connect();
    }
  }

  public isSimulating(): boolean {
    return this.forceSimulation || this.connectionState === 'simulation';
  }

  public getState(): WsConnectionState {
    return this.connectionState;
  }

  public onStateChange(listener: (state: WsConnectionState) => void) {
    this.stateListeners.add(listener);
    listener(this.connectionState);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public subscribe(handler: WsEventHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private setState(state: WsConnectionState) {
    this.connectionState = state;
    this.stateListeners.forEach((listener) => listener(state));
  }

  public connect() {
    if (this.forceSimulation) {
      this.setState('simulation');
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setState('probing');

    // First try the current host's WebSocket endpoint (/ws on port 3000), which hosts both web and ws.
    // If running in pure external port 7788 standalone mode and on HTTP localhost, fallback to port 7788.
    let targetUrl: string;
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (isHttps) {
      // Browsers forbid insecure ws:// on HTTPS pages; must connect to wss on current host
      targetUrl = `wss://${window.location.host}/ws`;
    } else if (isLocalhost && this.retryAttempt % 2 === 1) {
      // Alternate retry to local port 7788 standalone gateway
      targetUrl = 'ws://127.0.0.1:7788/ws';
    } else if (typeof window !== 'undefined') {
      targetUrl = `ws://${window.location.host}/ws`;
    } else {
      targetUrl = 'ws://localhost:3000/ws';
    }

    try {
      this.ws = new WebSocket(targetUrl);

      this.ws.onopen = () => {
        this.retryAttempt = 0;
        this.setState('connected');
        this.startHeartbeat();
        // Request fresh system status immediately
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'request_system_status' }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handlers.forEach((h) => h(data));
        } catch {
          // Non-json heartbeat
        }
      };

      this.ws.onerror = () => {
        this.handleDisconnect();
      };

      this.ws.onclose = () => {
        this.handleDisconnect();
      };
    } catch {
      this.handleDisconnect();
    }
  }

  private handleDisconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws = null;
    }

    // Degrade smoothly to simulation while keeping a periodic probing heartbeat in the background
    this.setState('simulation');

    if (!this.forceSimulation && !this.reconnectTimer) {
      const delay = Math.min(2500 * Math.pow(1.4, Math.min(this.retryAttempt, 5)), 15000);
      this.retryAttempt++;
      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, delay);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 10000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Send Approval decision back to gateway to unblock local Claude Code or Codex */
  public sendHitlDecision(requestId: string, action: 'approve' | 'rollback' | 'inject', prompt?: string) {
    const payload = {
      type: 'hitl_resolution',
      requestId,
      action,
      prompt,
      timestamp: Date.now(),
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
    return payload;
  }

  /** REST: Fetch real local system and git status */
  public async fetchRealStatus(): Promise<RealSystemStatus | null> {
    try {
      const res = await fetch('/api/real/status');
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return null;
  }

  /** REST: Fetch real git diff text */
  public async fetchGitDiff(): Promise<string> {
    try {
      const res = await fetch('/api/real/diff');
      if (res.ok) {
        const data = await res.json();
        return data.diff || '';
      }
    } catch {}
    return '';
  }

  /** REST: Execute real terminal command on the host */
  public async executeCommand(command: string): Promise<{
    command: string;
    stdout: string;
    stderr: string;
    output: string;
    exitCode: number;
    durationMs: number;
  }> {
    const res = await fetch('/api/real/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Execution failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  }

  /** REST: Inject .claude/settings.json into current local repository */
  public async setupClaudeHooks(): Promise<{
    success: boolean;
    message: string;
    settingsPath: string;
  }> {
    const res = await fetch('/api/real/setup-claude-hooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Hook setup failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  }

  /** REST: Dispatch a real test hook event to verify the gateway round-trip */
  public async triggerRealTest(risk: 'high' | 'normal' = 'normal'): Promise<any> {
    const res = await fetch('/api/real/test-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ risk }),
    });
    return await res.json();
  }
}

export const telemetryBus = new WebSocketTelemetryBus();
