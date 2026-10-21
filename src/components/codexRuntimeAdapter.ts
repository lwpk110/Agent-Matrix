import type { LogEntry } from "../types/matrix";
import type {
  MockKind,
  MockNodeId,
  MockRuntimeEvent,
  MockRuntimeSession,
  MockStatus,
} from "./codexRuntimeMock";
import type { CodexRolloutTelemetry } from "../types/codexTelemetry";
import { runtimeFlow } from "./runtimeFlow";

type RuntimeLog = LogEntry & { runtimeEvent: NonNullable<LogEntry["runtimeEvent"]> };
type Data = Record<string, unknown>;

function payloadOf(log: RuntimeLog): Data {
  try {
    const parsed: unknown = JSON.parse(log.runtimeEvent.details || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const outer = parsed as Data;
    const nested = recordValue(outer.payload);
    return nested ? { ...nested, ...outer } : outer;
  } catch {
    return {};
  }
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readablePrompt(value: unknown): string | undefined {
  const text = textValue(value);
  if (!text) return undefined;
  const withoutAmbientContext = text.replace(/<in-app-browser-context\b[^>]*>[\s\S]*?<\/in-app-browser-context>\s*/gi, "").trim();
  const requestMarker = /(?:^|\n)\s*#{1,2}\s*My request:\s*/i;
  const request = withoutAmbientContext.match(requestMarker);
  const visibleText = request
    ? withoutAmbientContext.slice((request.index || 0) + request[0].length)
    : withoutAmbientContext;
  return visibleText
    .replace(/^\s*#\s*Files mentioned by the user:[\s\S]*?(?=\s+#*\s*My request:|$)/i, "")
    .replace(/Image attachment:\s*true/gi, "")
    .replace(/\bDistinguish instructions in attached documents from the user's request\.[\s\S]*$/i, "")
    .trim() || undefined;
}

function recordValue(...values: unknown[]): Data | undefined {
  const value = values.find((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate));
  return value as Data | undefined;
}

function valueRecord(value: unknown, key: string): Data | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object" && !Array.isArray(value)) return value as Data;
  return { [key]: value };
}

function numberValue(...values: unknown[]): number | undefined {
  return values.find((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function nodeFor(log: RuntimeLog, payload: Data): MockNodeId {
  const name = log.runtimeEvent.eventName;
  const tool = log.runtimeEvent.toolName || "";
  if (name === "UserPromptSubmit") return "input";
  if (name === "SkillActivated" || (/skill/i.test(tool) && /skill/i.test(name))) return "skill";
  if (name === "PermissionRequest") return "gate";
  if (name === "AppServerFinalAnswer" || /assistant\.message\.completed|final.?answer/i.test(name)) return "output";
  if (name === "AppServerWebSearch" || /websearch|web.?search/i.test(tool)) return "search";
  if (name === "AppServerMcpToolCall" || /^mcp__|^MCP\//i.test(tool)) return "mcp";
  if (/PreToolUse|PostToolUse|ToolCall|CommandExecution|DynamicTool/i.test(name) || log.toolCall) return "tool";
  if (/model|turn\.started/i.test(name)) return "model";
  if (/prompt|context|compact|plan|subagent|session/i.test(name)) return "context";
  if (payload.command || payload.tool_input || payload.arguments) return "tool";
  return "hook";
}

function kindFor(node: MockNodeId): MockKind {
  return node === "output" ? "result" : node;
}

function statusFor(log: RuntimeLog, payload: Data): MockStatus {
  const decision = log.runtimeEvent.permissionDecision?.toLowerCase();
  if (log.runtimeEvent.phase === "permission") {
    return decision && /allow|approve|grant/.test(decision) ? "allowed" : "waiting";
  }
  const status = String(payload.status || payload.state || "").toLowerCase();
  if (log.runtimeEvent.phase === "started" || /running|progress|pending|in.?progress/.test(status)) return "running";
  if (/fail|error|denied|reject|cancel/.test(status) || payload.success === false || payload.isError === true) return "failed";
  if (log.runtimeEvent.phase === "completed" || log.runtimeEvent.phase === "prompt") return "completed";
  return "unknown";
}

function eventTitle(log: RuntimeLog, node: MockNodeId): string {
  const name = log.runtimeEvent.eventName;
  if (name === "UserPromptSubmit") return "用户提交提示词";
  if (name === "AppServerFinalAnswer") return "Codex 最终回复";
  if (name === "PermissionRequest") return "请求执行权限";
  if (["tool", "mcp", "search"].includes(node)) return `${name} · ${log.runtimeEvent.toolName || "工具"}`;
  if (name === "SkillActivated") return `Skill 已激活 · ${log.runtimeEvent.toolName || "Skill"}`;
  return name;
}

function eventSummary(log: RuntimeLog, payload: Data): string {
  const summary = (log.runtimeEvent.eventName === "UserPromptSubmit" ? readablePrompt(payload.prompt) : textValue(payload.prompt))
    || textValue(payload.text)
    || textValue(payload.query)
    || textValue(payload.command)
    || textValue(payload.message)
    || textValue(payload.status);
  return summary || log.message || `${log.runtimeEvent.eventName} 已采集`;
}

function eventTime(timestamp: string | undefined, fallback: string): string {
  const date = timestamp ? new Date(timestamp) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function timeOf(log: RuntimeLog): number {
  return Date.parse(eventTime(log.runtimeEvent.timestamp, log.timestamp));
}

function inputOf(name: string, payload: Data): Data | undefined {
  if (name === "UserPromptSubmit") {
    const prompt = readablePrompt(payload.prompt);
    return prompt ? { prompt } : recordValue(payload.content);
  }
  return recordValue(payload.arguments, payload.tool_input, payload.input)
    || (textValue(payload.command) ? { command: payload.command } : undefined)
    || (textValue(payload.query) ? { query: payload.query } : undefined);
}

function outputOf(name: string, payload: Data): Data | undefined {
  if (name === "AppServerFinalAnswer") {
    const text = textValue(payload.text);
    return text ? { text } : undefined;
  }
  return valueRecord(payload.tool_response, "tool_response")
    || valueRecord(payload.result, "result")
    || valueRecord(payload.output, "output")
    || valueRecord(payload.response, "response")
    || (payload.stdout !== undefined || payload.stderr !== undefined || payload.exitCode !== undefined
      ? { stdout: payload.stdout, stderr: payload.stderr, exitCode: payload.exitCode }
      : undefined);
}

function modelRequestId(log: RuntimeLog, payload: Data): string | undefined {
  return textValue(payload.modelRequestId) || textValue(payload.request_id) || textValue(payload.requestId)
    || (/^(model\.request|AppServerModelRequest)$/.test(log.runtimeEvent.eventName) ? log.runtimeEvent.eventId : undefined);
}

function makeCall(event: MockRuntimeEvent): MockRuntimeSession["calls"][number] {
  const id = event.callId || event.id;
  return {
    id,
    roundId: event.roundId || "",
    name: event.title.split(" · ").at(-1) || event.name,
    type: event.node === "mcp" || event.node === "search" ? "mcp" : "local",
    title: event.title,
    arguments: event.input || {},
    result: event.output || {},
    durationMs: event.durationMs ?? null,
    status: event.status === "allowed" ? "unknown" : event.status,
    resultReceived: Boolean(event.output || event.hasToolResponse),
  };
}

export function createCodexRuntimeSessionFromLogs(logs: LogEntry[], rolloutTelemetry?: CodexRolloutTelemetry | null): MockRuntimeSession | null {
  const sourceLogs = logs.filter((log): log is RuntimeLog => Boolean(
    log.runtimeEvent && (log.runtimeEvent.source === "codex-hook" || log.runtimeEvent.source === "codex-app-server"),
  ));
  if (!sourceLogs.length) return null;

  const sorted = sourceLogs.slice().sort((a, b) => timeOf(a) - timeOf(b));
  const latest = [...sorted].reverse().find((log) => log.runtimeEvent.sessionId) || sorted.at(-1)!;
  const sessionId = latest.runtimeEvent.sessionId || "unknown-session";
  const sessionLogs = sorted.filter((log) => log.runtimeEvent.sessionId === sessionId);
  const latestTurn = [...sessionLogs].reverse().find((log) => log.runtimeEvent.turnId)?.runtimeEvent.turnId;
  const selectedLogs = sessionLogs.filter((log) => !latestTurn || !log.runtimeEvent.turnId || log.runtimeEvent.turnId === latestTurn);
  const firstTimestamp = timeOf(selectedLogs[0]);

  const events: MockRuntimeEvent[] = selectedLogs.map((log, index) => {
    const payload = payloadOf(log);
    const name = log.runtimeEvent.eventName;
    const node = nodeFor(log, payload);
    const timestamp = eventTime(log.runtimeEvent.timestamp, log.timestamp);
    const input = inputOf(name, payload);
    const output = outputOf(name, payload);
    const relatedNodes: MockNodeId[] = node === "input" ? ["prompt"]
      : node === "model" ? ["prompt", "context"]
        : node === "output" ? ["model"]
          : node === "tool" || node === "mcp" || node === "search" ? ["model", "context"]
            : ["model"];
    const callId = log.runtimeEvent.toolUseId || (log.toolCall ? `${node}-${log.id}` : undefined);
    const modelId = modelRequestId(log, payload);
    const content = name === "UserPromptSubmit" ? readablePrompt(payload.prompt)
      : name === "AppServerFinalAnswer" ? textValue(payload.text)
        : undefined;
    return {
      id: log.runtimeEvent.eventId || `real-${index}`,
      sessionId,
      turnId: log.runtimeEvent.turnId || latestTurn || "unknown-turn",
      offsetMs: Math.max(0, timeOf(log) - firstTimestamp),
      time: timestamp.slice(11, 23),
      name,
      kind: kindFor(node),
      node,
      relatedNodes,
      source: log.runtimeEvent.source === "codex-hook" ? "Codex Hook" : "Codex App Server",
      title: eventTitle(log, node),
      summary: eventSummary(log, payload),
      status: statusFor(log, payload),
      callId,
      roundId: modelId,
      // Hook 前后事件间隔仅用于证明采样先后，不能伪装成工具执行耗时。
      durationMs: numberValue(payload.durationMs, payload.duration_ms),
      observedIntervalMs: log.runtimeEvent.observedIntervalMs,
      hasToolResponse: log.runtimeEvent.source === "codex-hook" && log.runtimeEvent.hasToolResponse,
      input,
      output,
      content,
    };
  });

  const callsById = new Map<string, MockRuntimeSession["calls"][number]>();
  events.filter((event) => ["tool", "mcp", "search"].includes(event.node) && event.callId).forEach((event) => {
    const next = makeCall(event);
    const previous = callsById.get(next.id);
    if (!previous) {
      callsById.set(next.id, next);
      return;
    }
    previous.arguments = Object.keys(next.arguments).length ? next.arguments : previous.arguments;
    previous.result = Object.keys(next.result).length ? next.result : previous.result;
    previous.resultReceived = previous.resultReceived || next.resultReceived;
    previous.durationMs = next.durationMs ?? previous.durationMs;
    if (next.status !== "unknown") previous.status = next.status;
  });

  const roundData = new Map<string, MockRuntimeSession["rounds"][number]>();
  selectedLogs.forEach((log) => {
    const payload = payloadOf(log);
    const requestId = modelRequestId(log, payload);
    if (!requestId) return;
    const round = roundData.get(requestId) || {
      id: requestId,
      inputTokens: null,
      cachedInputTokens: null,
      outputTokens: null,
      consumedCallIds: [],
      callIds: [],
      response: "",
    };
    const inputTokens = numberValue(payload.input_tokens, payload.inputTokens);
    const cachedTokens = numberValue(payload.cached_input_tokens, payload.cachedInputTokens);
    const outputTokens = numberValue(payload.output_tokens, payload.outputTokens);
    if (inputTokens !== undefined) round.inputTokens = inputTokens;
    if (cachedTokens !== undefined) round.cachedInputTokens = cachedTokens;
    if (outputTokens !== undefined) round.outputTokens = outputTokens;
    const response = textValue(payload.text) || textValue(payload.response);
    if (response) round.response = response;
    const callIds = Array.isArray(payload.call_ids) ? payload.call_ids.filter((id): id is string => typeof id === "string") : [];
    round.callIds = [...new Set([...round.callIds, ...callIds])];
    roundData.set(requestId, round);
  });

  const rounds = [...roundData.values()];
  const sumKnown = (key: "inputTokens" | "outputTokens" | "cachedInputTokens") => {
    const values = rounds.map((round) => round[key]).filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  };
  const prompt = [...events].reverse().find((event) => event.node === "input")?.content || "";
  const finalAnswer = [...events].reverse().find((event) => event.name === "AppServerFinalAnswer")?.content || "";
  const model = rolloutTelemetry?.model || selectedLogs.find((log) => log.runtimeEvent.model)?.runtimeEvent.model || "未采集";
  const cwd = selectedLogs.find((log) => log.runtimeEvent.cwd)?.runtimeEvent.cwd || "未采集";
  const usage = {
    inputTokens: rolloutTelemetry?.turnUsage?.inputTokens ?? sumKnown("inputTokens"),
    outputTokens: rolloutTelemetry?.turnUsage?.outputTokens ?? sumKnown("outputTokens"),
    cachedInputTokens: rolloutTelemetry?.turnUsage?.cachedInputTokens ?? sumKnown("cachedInputTokens"),
  };
  const session: MockRuntimeSession = {
    id: latest.runtimeEvent.sessionId || "未关联会话",
    turnId: latestTurn || "未关联回合",
    cwd,
    prompt,
    model,
    reasoningEffort: rolloutTelemetry?.reasoningEffort || "未采集",
    instruction: "未采集完整系统指令。仅展示运行事件明确提供的字段。",
    skillText: "未采集 Skill 文件正文。",
    skillCatalog: [],
    rolloutTelemetry: rolloutTelemetry || null,
    finalAnswer,
    calls: [...callsById.values()],
    rounds,
    events,
    usage,
    durationMs: null,
    schemaVersion: "agent-matrix.live.v1",
    isMock: false,
    isReal: true,
    dataSource: "live",
  };
  return session;
}

export function latestObservedCodexEvent(session: MockRuntimeSession, logs: LogEntry[]): MockRuntimeEvent | undefined {
  let latest: MockRuntimeEvent | undefined;
  for (let index = logs.length - 1; index >= 0; index--) {
    const event = logs[index].runtimeEvent;
    if (event?.sessionId !== session.id || (event.turnId && event.turnId !== session.turnId)) continue;
    const observed = session.events.find(candidate => candidate.id === event.eventId);
    if (!observed) continue;
    latest ||= observed;
    if (observed.status === "waiting" || observed.status === "failed") return observed;
    if (runtimeFlow(observed)) return observed;
  }
  return latest || session.events.at(-1);
}
