import type { LogEntry, RealSystemStatus } from "../types/matrix";
import type { RuntimeEvent, RuntimeKind, RuntimeNodeId, RuntimeProviderId, RuntimeSession, RuntimeSkillSource, RuntimeStatus, RuntimeTelemetry } from "../types/runtime";
import { createCodexRuntimeSessionFromLogs } from "../components/codexRuntimeAdapter";
import type { CodexRolloutTelemetry } from "../types/codexTelemetry";

type Details = Record<string, unknown>;
export type RuntimeGatewayState = "starting" | "listening" | "offline";

export interface RuntimeConnectionStatus {
  hookGatewayState?: RuntimeGatewayState;
  hookPort?: number;
  appServerState?: RuntimeGatewayState;
}

export interface RuntimeAgentPlugin {
  provider: RuntimeProviderId;
  label: string;
  visual?: { accent: string; coreIcon: 'activity' | 'sparkles' | 'claude-mark' | 'codex-mark' };
  sourceLabel?(log: LogEntry): string;
  paths: { runtime: string; twoDimensional: string; threeDimensional: string };
  accepts(log: LogEntry): boolean;
  mapEvent(context: { log: LogEntry; base: RuntimeEvent }): RuntimeEvent;
  project?(logs: LogEntry[], telemetry?: RuntimeTelemetry | null): RuntimeSession | null;
  loadTelemetry?(sessionId: string, turnId: string, signal: AbortSignal): Promise<RuntimeTelemetry | null>;
  loadSkillSources?(name: string, cwd: string, signal: AbortSignal): Promise<RuntimeSkillSource[]>;
  clearRuntime?(): Promise<void>;
  connectionStatus?(status: RealSystemStatus | null | undefined): RuntimeConnectionStatus;
  capabilities?: { rolloutTelemetry?: boolean; skills?: boolean; promptTelemetry?: boolean };
}

const plugins = new Map<RuntimeProviderId, RuntimeAgentPlugin>();
export function registerRuntimePlugin(plugin: RuntimeAgentPlugin) { plugins.set(plugin.provider, plugin); return plugin; }
export function getRuntimePlugin(provider: RuntimeProviderId) {
  const plugin = plugins.get(provider);
  if (!plugin) throw new Error(`Unknown runtime provider: ${provider}`);
  return plugin;
}
export function listRuntimePlugins() { return [...plugins.values()]; }
export function findRuntimePluginByPath(pathname: string) {
  return listRuntimePlugins().find(plugin => Object.values(plugin.paths).includes(pathname));
}
export function getRuntimeConnection(plugin: RuntimeAgentPlugin, status: RealSystemStatus | null | undefined): RuntimeConnectionStatus {
  return plugin.connectionStatus?.(status) || {};
}

function details(log: LogEntry): Details { try { const parsed = JSON.parse(log.runtimeEvent?.details || "{}"); return parsed && typeof parsed === "object" ? parsed as Details : {}; } catch { return {}; } }
function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function node(name: string, tool?: string): RuntimeNodeId {
  if (name === "UserPromptSubmit") return "input";
  if (/SkillActivated|skill/i.test(name)) return "skill";
  if (/Permission/.test(name)) return "gate";
  if (name === "Stop" || name === "AppServerFinalAnswer") return "output";
  if (/Mcp/i.test(name) || /^mcp__/i.test(tool || "")) return "mcp";
  if (/WebSearch|search/i.test(`${name} ${tool || ""}`)) return "search";
  if (/Tool|Command|Bash|Read|Write|Edit/.test(`${name} ${tool || ""}`)) return "tool";
  if (/model/i.test(name)) return "model";
  if (/Session|Subagent|Setup|context/i.test(name)) return "context";
  return "hook";
}
function status(log: LogEntry, payload: Details): RuntimeStatus {
  const event = log.runtimeEvent!;
  const decision = event.permissionDecision?.toLowerCase();
  if (event.eventName === "PermissionDenied" || decision === "denied" || decision === "deny") return "failed";
  if (event.phase === "permission") return decision === "allow" ? "allowed" : "waiting";
  if (event.eventName === "PostToolUseFailure" || payload.success === false || payload.isError === true || /fail|error|denied|reject/.test(String(payload.status || ""))) return "failed";
  if (event.phase === "started") return "running";
  if (event.phase === "completed" || event.phase === "prompt") return "completed";
  return "unknown";
}
function baseEvent(log: LogEntry, first: number, index: number, sourceLabel: string): RuntimeEvent {
  const event = log.runtimeEvent!; const payload = details(log); const eventNode = node(event.eventName, event.toolName);
  const timestamp = event.timestamp || log.timestamp; const timeMs = Date.parse(timestamp);
  const prompt = event.eventName === "UserPromptSubmit" ? text(payload.prompt) : undefined;
  const answer = event.eventName === "Stop" || event.eventName === "AppServerFinalAnswer" ? text(payload.last_assistant_message) || text(payload.text) : undefined;
  const input = prompt ? { prompt } : payload.tool_input && typeof payload.tool_input === "object" ? payload.tool_input as Details : undefined;
  return {
    id: event.eventId || `runtime-${index}`, provider: event.provider, sessionId: event.sessionId || "unknown-session", turnId: event.turnId || "unknown-turn",
    offsetMs: Number.isFinite(timeMs) ? Math.max(0, timeMs - first) : 0, time: timestamp.slice(11, 23), name: event.eventName,
    kind: (eventNode === "output" ? "result" : eventNode) as RuntimeKind, node: eventNode,
    relatedNodes: eventNode === "input" ? ["prompt"] : eventNode === "output" ? ["model"] : ["model"],
    source: sourceLabel,
    title: event.eventName === "UserPromptSubmit" ? "用户提交提示词" : event.eventName === "Stop" ? "最终答复" : event.eventName,
    summary: answer || prompt || text(payload.error) || text(payload.message) || event.toolName || log.message || `${event.eventName} 已采集`,
    status: status(log, payload), isReal: true, callId: event.toolUseId, toolName: event.toolName,
    observedIntervalMs: event.observedIntervalMs, hasToolResponse: event.hasToolResponse,
    input, content: prompt || answer,
  };
}
function genericSession(plugin: RuntimeAgentPlugin, logs: LogEntry[], telemetry?: RuntimeTelemetry | null): RuntimeSession | null {
  const source = logs.filter(log => log.runtimeEvent && plugin.accepts(log));
  if (!source.length) return null;
  const sorted = source.slice().sort((a, b) => Date.parse(a.runtimeEvent?.timestamp || a.timestamp) - Date.parse(b.runtimeEvent?.timestamp || b.timestamp));
  const latest = sorted.at(-1)!; const currentSession = latest.runtimeEvent!.sessionId || "unknown-session"; const sessionLogs = sorted.filter(log => (log.runtimeEvent!.sessionId || "unknown-session") === currentSession);
  const currentTurn = [...sessionLogs].reverse().find(log => log.runtimeEvent!.turnId)?.runtimeEvent!.turnId;
  const selected = sessionLogs.filter(log => !currentTurn || !log.runtimeEvent!.turnId || log.runtimeEvent!.turnId === currentTurn);
  const first = Date.parse(selected[0].runtimeEvent?.timestamp || selected[0].timestamp);
  const events = selected.map((log, index) => plugin.mapEvent({ log, base: baseEvent(log, first, index, plugin.sourceLabel?.(log) || log.runtimeEvent!.source) }));
  const calls = new Map<string, RuntimeSession["calls"][number]>();
  for (const event of events) if (event.callId && ["tool", "mcp", "search"].includes(event.node)) {
    const toolName = events.find(candidate => candidate.callId === event.callId && candidate.toolName)?.toolName || event.toolName || event.summary;
    const prior = calls.get(event.callId); const next = { id: event.callId, roundId: event.roundId || "", name: toolName, type: event.node === "mcp" || event.node === "search" ? "mcp" as const : "local" as const, title: toolName, arguments: event.input || {}, result: event.output || {}, durationMs: event.durationMs ?? null, status: event.status, resultReceived: Boolean(event.output || event.hasToolResponse) };
    const terminal = prior?.status === "completed" || prior?.status === "failed";
    calls.set(event.callId, prior ? { ...prior, ...next, name: prior.name || next.name, title: prior.title || next.title, arguments: Object.keys(next.arguments).length ? next.arguments : prior.arguments, result: Object.keys(next.result).length ? next.result : prior.result, resultReceived: Boolean(prior.resultReceived || next.resultReceived), status: terminal && next.status === "running" ? prior.status : next.status === "unknown" ? prior.status : next.status } : next);
  }
  const prompt = [...events].reverse().find(event => event.node === "input")?.content || "";
  const finalAnswer = [...events].reverse().find(event => event.node === "output")?.content || "";
  const observed = <K extends "cwd" | "model" | "reasoningEffort">(key: K) => [...selected].reverse().map(log => log.runtimeEvent![key]).find((value): value is string => Boolean(value));
  const resolvedTelemetry = telemetry ? { ...telemetry, modelSource: telemetry.model ? telemetry.modelSource || 'request-statistics' : telemetry.modelSource } : null;
  if (plugin.provider === 'claude') for (const metadata of resolvedTelemetry?.toolCallMetadata ?? []) {
    const existing = calls.get(metadata.callId);
    const status: RuntimeStatus = metadata.resultObserved ? metadata.isError === true ? 'failed' : 'completed' : existing?.status ?? 'unknown';
    const metadataType = metadata.name.startsWith('mcp__') || /search/i.test(metadata.name) ? 'mcp' as const : 'local' as const;
    calls.set(metadata.callId, { id: metadata.callId, roundId: existing?.roundId || '', name: metadata.name || existing?.name || '未采集', type: existing?.type || metadataType, title: metadata.name || existing?.title || 'Claude 工具', arguments: existing?.arguments && Object.keys(existing.arguments).length ? existing.arguments : {}, result: existing?.result && Object.keys(existing.result).length ? existing.result : {}, durationMs: existing?.durationMs ?? null, status: existing?.status === 'failed' ? 'failed' : status, resultReceived: existing?.resultReceived || metadata.resultObserved, resultError: existing?.resultError === true ? true : metadata.isError, observedAt: existing?.observedAt || metadata.observedAt, source: existing?.source || 'claude-transcript', metadataOnly: existing ? existing.metadataOnly : true });
  }
  return { id: currentSession, provider: plugin.provider, turnId: currentTurn || "unknown-turn", cwd: observed("cwd") || "未采集", prompt, model: resolvedTelemetry?.model || observed("model") || "未采集", reasoningEffort: resolvedTelemetry?.reasoningEffort || observed("reasoningEffort") || "未采集", instruction: "未采集完整系统指令。", skillText: "未采集 Skill 文件正文。", skillCatalog: [], rolloutTelemetry: resolvedTelemetry, finalAnswer, calls: [...calls.values()], rounds: [], events, usage: { inputTokens: resolvedTelemetry?.turnUsage?.inputTokens ?? null, outputTokens: resolvedTelemetry?.turnUsage?.outputTokens ?? null, cachedInputTokens: resolvedTelemetry?.turnUsage?.cachedInputTokens ?? null }, durationMs: resolvedTelemetry?.durationMs ?? null, schemaVersion: "agent-matrix.runtime.v1", isMock: false, isReal: true, dataSource: "live" };
}
export function createRuntimeSessionFromLogs(plugin: RuntimeAgentPlugin, logs: LogEntry[], telemetry?: RuntimeTelemetry | null): RuntimeSession | null {
  const projected = plugin.project ? plugin.project(logs, telemetry) : genericSession(plugin, logs, telemetry);
  return projected ? { ...projected, provider: plugin.provider, capabilities: plugin.capabilities } : null;
}
export function latestObservedRuntimeEvent(session: RuntimeSession, logs: LogEntry[]) { return session.events.find(event => event.id === [...logs].reverse().find(log => log.runtimeEvent?.provider === session.provider && log.runtimeEvent?.sessionId === session.id && (!log.runtimeEvent?.turnId || log.runtimeEvent.turnId === session.turnId))?.runtimeEvent?.eventId) || session.events.at(-1); }

registerRuntimePlugin({ provider: "codex", label: "Codex", visual: { accent: '#e8e8e8', coreIcon: 'codex-mark' }, paths: { runtime: "/codex/runtime", twoDimensional: "/codex", threeDimensional: "/codex/3d" }, accepts: log => log.runtimeEvent?.provider === "codex", sourceLabel: log => log.runtimeEvent?.source === "codex-hook" ? "Codex Hook" : "Codex App Server", mapEvent: ({ base }) => base, connectionStatus: status => ({ hookGatewayState: status?.codexHookGatewayState, hookPort: status?.codexHookPort, appServerState: status?.codexAppServerState }), project: (logs, telemetry) => createCodexRuntimeSessionFromLogs(logs.filter(log => log.runtimeEvent?.provider === "codex"), telemetry as CodexRolloutTelemetry | null | undefined), loadTelemetry: async (sessionId, turnId, signal) => {
  const query = new URLSearchParams({ sessionId, turnId }); const response = await fetch(`/api/real/codex-rollout?${query}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Runtime telemetry unavailable"); return (await response.json() as { telemetry: RuntimeTelemetry | null }).telemetry;
}, loadSkillSources: async (name, cwd, signal) => {
  const query = new URLSearchParams({ name, cwd });
  const response = await fetch(`/api/real/codex-skill?${query}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Skill 文件查询失败");
  return (await response.json() as { sources: RuntimeSkillSource[] }).sources;
}, clearRuntime: async () => { const response = await fetch("/api/real/codex-events", { method: "DELETE" }); if (!response.ok) throw new Error("Could not clear Codex runtime events"); }, capabilities: { rolloutTelemetry: true, skills: true, promptTelemetry: true } });
registerRuntimePlugin({ provider: "claude", label: "Claude Code", visual: { accent: '#D97757', coreIcon: 'claude-mark' }, paths: { runtime: "/claude/runtime", twoDimensional: "/claude", threeDimensional: "/claude/3d" }, accepts: log => log.runtimeEvent?.provider === "claude", sourceLabel: log => log.runtimeEvent?.source === "claude-desktop" ? "Claude Desktop" : "Claude Hook", mapEvent: ({ base, log }) => {
  const name = log.runtimeEvent?.eventName;
  if (name === "PermissionDenied") return { ...base, title: "权限被拒绝", status: "failed", node: "gate", kind: "gate" };
  if (name === "PreCompact" || name === "PostCompact") return { ...base, node: "context", kind: "context", title: name === "PreCompact" ? "开始压缩上下文" : "完成压缩上下文" };
  if (name === "SubagentStop") return { ...base, node: "context", kind: "context", title: "子代理结束", content: undefined };
  return base;
}, connectionStatus: status => ({ hookGatewayState: status?.claudeHookGatewayState, hookPort: status?.claudeHookPort }), loadTelemetry: async (sessionId, turnId, signal) => { const query = new URLSearchParams({ sessionId, turnId }); const response = await fetch(`/api/real/claude-telemetry?${query}`, { cache: "no-store", signal }); if (!response.ok) throw new Error("Claude telemetry unavailable"); return (await response.json() as { telemetry: RuntimeTelemetry | null }).telemetry; }, clearRuntime: async () => { const response = await fetch("/api/real/claude-events", { method: "DELETE" }); if (!response.ok) throw new Error("Could not clear Claude runtime events"); }, capabilities: { rolloutTelemetry: true, promptTelemetry: true } });
