import type { LogEntry, RealSystemStatus, WsConnectionState } from "../types/matrix";
import type { CodexRolloutTelemetry } from "../types/codexTelemetry";

export type CoreStatus = {
  state: "normal" | "compacting" | "compacted" | "warning" | "error";
  label: string;
  detail: string;
};

type StatusInput = {
  logs: LogEntry[];
  sessionId: string;
  turnId: string;
  connectionState: WsConnectionState;
  realStatus?: RealSystemStatus | null;
  telemetry?: CodexRolloutTelemetry | null;
  now?: number;
};

type ObservedEvent = { log: LogEntry; name: string; payload: Record<string, unknown> };

function payloadOf(log: LogEntry): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(log.runtimeEvent?.details || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const record = value as Record<string, unknown>;
    return record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
      ? { ...(record.payload as Record<string, unknown>), ...record }
      : record;
  } catch {
    return {};
  }
}

function observedTime(log: LogEntry, now: number): number {
  if (log.runtimeEvent?.source === "codex-hook") {
    const hookTime = Date.parse(log.runtimeEvent.timestamp || "");
    if (Number.isFinite(hookTime)) return hookTime;
  }
  const localTime = log.timestamp;
  if (/^\d{2}:\d{2}:\d{2}$/.test(localTime)) {
    const date = new Date(now);
    const [hours, minutes, seconds] = localTime.split(":").map(Number);
    date.setHours(hours, minutes, seconds, 0);
    const result = date.getTime();
    return result > now + 60_000 ? result - 86_400_000 : result;
  }
  return Date.parse(log.runtimeEvent?.timestamp || localTime) || now;
}

function failed(event: ObservedEvent): boolean {
  const status = String(event.payload.status || event.payload.state || "").toLowerCase();
  return /fail|error|denied|reject|cancel|timeout/.test(status) ||
    /Failure|Error|Fatal|Timeout|Network|Quota|RateLimit/i.test(event.name) ||
    event.payload.success === false || event.payload.isError === true ||
    Boolean(event.payload.error) ||
    (typeof event.payload.exitCode === "number" && event.payload.exitCode !== 0);
}

function recovered(event: ObservedEvent): boolean {
  return event.name === "PostToolUse" || event.name === "AppServerFinalAnswer" ||
    (event.name === "AppServerCommandExecution" && !failed(event) && String(event.payload.status).toLowerCase() === "completed") ||
    (event.name === "AppServerMcpToolCall" && !failed(event) && String(event.payload.status).toLowerCase() === "completed");
}

export function codexCoreStatus(input: StatusInput): CoreStatus {
  const { now = Date.now() } = input;
  if (input.connectionState === "offline" || input.realStatus?.codexHookGatewayState === "offline" || input.realStatus?.codexAppServerState === "offline") {
    return { state: "error", label: "网络连接异常", detail: "本机 Codex 事件网关或 app-server 已断开。" };
  }

  const windowTokens = input.telemetry?.contextWindowTokens;
  const contextTokens = input.telemetry?.latestRequest?.inputTokens;
  if (windowTokens && contextTokens !== null && contextTokens !== undefined && contextTokens > windowTokens) {
    return { state: "error", label: "上下文超出窗口", detail: `${contextTokens.toLocaleString()} / ${windowTokens.toLocaleString()} tokens` };
  }

  const sessionLogs = input.logs.filter(log => log.runtimeEvent?.sessionId === input.sessionId);
  const currentTurnLogs = sessionLogs.filter(log => log.runtimeEvent?.turnId === input.turnId);
  const scopedLogs = currentTurnLogs.length ? currentTurnLogs : sessionLogs;
  const events: ObservedEvent[] = scopedLogs.map(log => ({ log, name: log.runtimeEvent?.eventName || "", payload: payloadOf(log) }));
  const failureIndex = events.reduce((last, event, index) => failed(event) ? index : last, -1);
  const recoveryIndex = events.reduce((last, event, index) => recovered(event) ? index : last, -1);
  if (failureIndex > recoveryIndex) {
    const failedEvent = events[failureIndex];
    const name = failedEvent.name;
    const detail = typeof failedEvent.payload.error === "string" ? failedEvent.payload.error
      : typeof failedEvent.payload.stderr === "string" ? failedEvent.payload.stderr
        : typeof failedEvent.payload.exitCode === "number" ? `退出码 ${failedEvent.payload.exitCode}` : name;
    const failureText = `${name} ${detail}`;
    const label = /network|timeout|connection/i.test(failureText) ? "网络请求失败"
      : /quota|rate.?limit|token.?limit|context.{0,16}(limit|exceed)|exceed.{0,16}context/i.test(failureText) ? "额度或上下文超限"
        : "运行步骤失败";
    return { state: "error", label, detail: String(detail).slice(0, 180) };
  }

  const compactionIndex = events.reduce((last, event, index) => /^(PreCompact|PostCompact|AppServerContextCompaction)$/.test(event.name) ? index : last, -1);
  if (compactionIndex >= 0) {
    const event = events[compactionIndex];
    if (event.name === "PreCompact") {
      const age = now - observedTime(event.log, now);
      return age <= 60_000
        ? { state: "compacting", label: "上下文压缩中", detail: "Codex 正在整理上下文以继续本回合。" }
        : { state: "warning", label: "压缩尚未确认完成", detail: "已收到 PreCompact，但还没有观测到 PostCompact。" };
    }
    if (now - observedTime(event.log, now) <= 5_000) {
      return { state: "compacted", label: "上下文已压缩", detail: "Codex 已记录本回合的上下文压缩。" };
    }
  }

  if (windowTokens && contextTokens !== null && contextTokens !== undefined && contextTokens / windowTokens >= 0.95) {
    return { state: "warning", label: "上下文接近容量上限", detail: `${contextTokens.toLocaleString()} / ${windowTokens.toLocaleString()} tokens` };
  }

  return { state: "normal", label: "Codex 核心运行中", detail: "等待下一条运行时事件。" };
}
