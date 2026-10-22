import { useEffect, useMemo, useState } from "react";
import type { RuntimeSession, RuntimeTelemetry } from "../types/runtime";
import type { RuntimeAgentPlugin } from "./runtimePlugins";

export type RuntimeTelemetryKey = { provider: string; sessionId: string; turnId: string };
type TelemetryLoader = (sessionId: string, turnId: string, signal: AbortSignal) => Promise<RuntimeTelemetry | null>;
export type RuntimeTelemetryScheduler = { setInterval(callback: () => void, intervalMs: number): ReturnType<typeof setInterval>; clearInterval(timer: ReturnType<typeof setInterval>): void };
const browserScheduler: RuntimeTelemetryScheduler = { setInterval: (callback, intervalMs) => setInterval(callback, intervalMs), clearInterval: timer => clearInterval(timer) };

export function createEmptyRuntimeSession(provider: string, state: "waiting" | "offline" | "error"): RuntimeSession {
  const label = state === "offline" ? "运行时网关离线" : state === "error" ? "运行时历史加载失败" : "等待运行时事件";
  return { id: "未观测到会话", provider, turnId: "未观测到回合", cwd: "未采集", prompt: label, model: "未采集", reasoningEffort: "未采集", instruction: "未采集", skillText: "未采集", skillCatalog: [], rolloutTelemetry: null, finalAnswer: "", calls: [], rounds: [], events: [], usage: { inputTokens: null, outputTokens: null, cachedInputTokens: null }, durationMs: null, schemaVersion: "agent-matrix.runtime.v1", isMock: false, isReal: false, dataSource: "live" };
}

/** 按会话键隔离轮询，已中止或过期的请求不得发布状态。 */
export function createRuntimeTelemetryPoller({ key, loadTelemetry, onTelemetry, scheduler = browserScheduler, intervalMs = 4000 }: { key: RuntimeTelemetryKey; loadTelemetry?: TelemetryLoader; onTelemetry: (telemetry: RuntimeTelemetry | null) => void; scheduler?: RuntimeTelemetryScheduler; intervalMs?: number }) {
  let active = true; let pending = false; let timer: ReturnType<typeof setInterval> | undefined; let controller: AbortController | undefined;
  const refresh = async () => {
    if (!active || pending || !loadTelemetry) return;
    pending = true;
    const requestController = new AbortController(); controller = requestController;
    try {
      const telemetry = await loadTelemetry(key.sessionId, key.turnId, requestController.signal);
      if (!active || controller !== requestController) return;
      if (telemetry === null) onTelemetry(null);
      else if ((telemetry.sessionId === null || telemetry.sessionId === undefined || telemetry.sessionId === key.sessionId) && (telemetry.turnId === null || telemetry.turnId === undefined || telemetry.turnId === key.turnId)) onTelemetry(telemetry);
      else onTelemetry(null);
    } catch { if (active && controller === requestController) onTelemetry(null); }
    finally { if (controller === requestController) pending = false; }
  };
  onTelemetry(null);
  if (loadTelemetry) { void refresh(); timer = scheduler.setInterval(() => { void refresh(); }, intervalMs); }
  return { refresh, dispose() { active = false; controller?.abort(); if (timer !== undefined) scheduler.clearInterval(timer); } };
}

export function useRuntimeTelemetry(plugin: RuntimeAgentPlugin, session: RuntimeSession | null) {
  const key = useMemo<RuntimeTelemetryKey | null>(() => session ? { provider: plugin.provider, sessionId: session.id, turnId: session.turnId } : null, [plugin.provider, session?.id, session?.turnId]);
  const [state, setState] = useState<{ key: RuntimeTelemetryKey | null; value: RuntimeTelemetry | null }>({ key: null, value: null });
  const matches = state.key?.provider === key?.provider && state.key?.sessionId === key?.sessionId && state.key?.turnId === key?.turnId;
  useEffect(() => {
    if (!key) { setState({ key: null, value: null }); return; }
    setState({ key, value: null });
    const poller = createRuntimeTelemetryPoller({ key, loadTelemetry: plugin.loadTelemetry, onTelemetry: value => setState({ key, value }) });
    return () => poller.dispose();
  }, [key?.provider, key?.sessionId, key?.turnId, plugin.loadTelemetry]);
  return matches ? state.value : null;
}
