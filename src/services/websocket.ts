/**
 * Real-time WebSocket Telemetry Bus Client
 * Connects to local AI Agent Gateway at ws://localhost:7788/ws
 * Supports Claude Code PreToolUse/PostToolUse hooks and Codex CLI events.
 * Smoothly degrades to simulation mode with background heartbeat probe when offline.
 */

import { WsConnectionState, HitlApprovalRequest, ToolCall } from '../types/matrix';

export type WsEventHandler = (event: {
  type: 'tool_call' | 'hitl_blocked' | 'telemetry' | 'agent_state' | 'pong';
  payload: unknown;
}) => void;

class WebSocketTelemetryBus {
  private ws: WebSocket | null = null;
  private url: string = 'ws://localhost:7788/ws';
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

    // Dual target: try local 7788 first, or relative host
    const targetUrl = this.retryAttempt % 2 === 0 ? 'ws://localhost:7788/ws' : 
      (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws` : 'ws://localhost:7788/ws');

    try {
      this.ws = new WebSocket(targetUrl);

      this.ws.onopen = () => {
        this.retryAttempt = 0;
        this.setState('connected');
        this.startHeartbeat();
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
        // Suppress noisy console error for dev server
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
      const delay = Math.min(3000 * Math.pow(1.5, Math.min(this.retryAttempt, 5)), 20000);
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
}

export const telemetryBus = new WebSocketTelemetryBus();
