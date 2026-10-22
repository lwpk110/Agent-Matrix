import type { RuntimeCall, RuntimeRound, RuntimeSession } from "../types/runtime";
import { createCodexRuntimeMock, type MockRuntimeEvent } from "./codexRuntimeMock";
import { runtimeResources } from "./runtimeResourcesModel";

export type PrototypeSessionState = "running" | "waiting" | "failed" | "completed";

export type PrototypeSessionFixture = {
  id: string;
  turnId: string;
  provider: "codex" | "claude";
  label: string;
  state: PrototypeSessionState;
  model: string;
  activity: string;
  age: string;
  link?: string;
  /** 包含在默认静态原型快照中的最后一条事件。 */
  visibleThroughMs: number;
};

export const prototypeSessionFixtures: readonly PrototypeSessionFixture[] = [
  { id: "session-active", turnId: "turn-7c21", provider: "claude", label: "架构梳理", state: "running", model: "claude-sonnet-5", activity: "工具正在执行", age: "刚刚", link: "workspace-alpha", visibleThroughMs: 7500 },
  { id: "session-codex", turnId: "turn-a940", provider: "codex", label: "运行时检查", state: "running", model: "GPT-5.4", activity: "等待工具结果", age: "12 秒", link: "workspace-alpha", visibleThroughMs: 9350 },
  { id: "session-review", turnId: "turn-1b93", provider: "claude", label: "PR 复核", state: "waiting", model: "claude-opus-4", activity: "等待权限确认", age: "1 分钟", visibleThroughMs: 4580 },
  { id: "session-failed", turnId: "turn-08fd", provider: "codex", label: "文档索引", state: "failed", model: "GPT-5.4", activity: "工具调用失败", age: "4 分钟", visibleThroughMs: 12390 },
  { id: "session-done", turnId: "turn-72e1", provider: "claude", label: "依赖盘点", state: "completed", model: "claude-sonnet-5", activity: "运行已结束", age: "18 分钟", visibleThroughMs: Infinity },
] as const;

export function prototypeSessionFixture(id: string) {
  return prototypeSessionFixtures.find(item => item.id === id) ?? prototypeSessionFixtures[1];
}

function remapValue(value: unknown, ids: Map<string, string>): unknown {
  if (typeof value === "string") return ids.get(value) ?? value;
  if (Array.isArray(value)) return value.map(item => remapValue(item, ids));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapValue(item, ids)]));
  return value;
}

function hasEvent(events: RuntimeSession["events"], name: string, id: string) {
  return events.some(event => event.name === name && event.callId === id);
}

/**
 * 从已可见事件生成会话投影。调用、轮次和最终输出只在对应的证据事件出现后才暴露，
 * 因此回放进度与详情面板不会看到未来结果。
 */
export function projectPrototypeSession(base: RuntimeSession, visibleEvents: RuntimeSession["events"]): RuntimeSession {
  const requestedCallIds = new Set(visibleEvents.filter(event => event.name === "model.tool_call" && event.callId).map(event => event.callId!));
  const calls: RuntimeCall[] = base.calls.filter(call => requestedCallIds.has(call.id)).map(call => {
    const completed = hasEvent(visibleEvents, "tool.completed", call.id);
    const failed = hasEvent(visibleEvents, "tool.failed", call.id);
    const started = hasEvent(visibleEvents, "tool.started", call.id);
    const waiting = hasEvent(visibleEvents, "PermissionRequest", call.id) && !hasEvent(visibleEvents, "approval.decision", call.id);
    return {
      ...call,
      result: completed || failed ? call.result : {},
      durationMs: completed || failed ? call.durationMs : null,
      resultReceived: completed || failed,
      status: failed ? "failed" : completed ? "completed" : waiting ? "waiting" : started ? "running" : "unknown",
    };
  });
  const requestedRounds = new Set(visibleEvents.filter(event => event.name === "model.request" && event.roundId).map(event => event.roundId!));
  const rounds: RuntimeRound[] = base.rounds.filter(round => requestedRounds.has(round.id)).map(round => {
    const complete = visibleEvents.some(event => event.name === "model.response.completed" && event.roundId === round.id);
    const emittedCallIds = new Set(visibleEvents.filter(event => event.name === "model.tool_call" && event.roundId === round.id && event.callId).map(event => event.callId!));
    const request = visibleEvents.find(event => event.name === "model.request" && event.roundId === round.id);
    const consumedCallIds = Array.isArray(request?.input?.added_tool_results)
      ? request!.input!.added_tool_results.map((item: { call_id?: string }) => item.call_id).filter((id): id is string => typeof id === "string")
      : [];
    const response = visibleEvents.find(event => event.name === "assistant.message" && event.roundId === round.id)?.content ?? "";
    return {
      ...round,
      inputTokens: complete ? round.inputTokens : null,
      cachedInputTokens: complete ? round.cachedInputTokens : null,
      outputTokens: complete ? round.outputTokens : null,
      callIds: round.callIds.filter(id => emittedCallIds.has(id)),
      consumedCallIds,
      response,
    };
  });
  const resource = runtimeResources(visibleEvents as MockRuntimeEvent[]);
  const finalAnswer = visibleEvents.some(event => event.name === "assistant.message.completed") ? base.finalAnswer : "";
  return {
    ...base,
    events: visibleEvents,
    calls,
    rounds,
    finalAnswer,
    usage: { inputTokens: resource.input || null, outputTokens: resource.output || null, cachedInputTokens: resource.cached },
    durationMs: visibleEvents.at(-1)?.offsetMs ?? null,
  };
}

/** 每个示例会话使用独立的 session/turn/call/round 标识，避免跨行关联。 */
export function createPrototypeSession(fixture: PrototypeSessionFixture, prompt?: string) {
  const base = createCodexRuntimeMock(prompt ?? `请完成「${fixture.label}」并报告当前已观测状态。`);
  const idMap = new Map<string, string>();
  idMap.set(base.id, fixture.id); idMap.set(base.turnId, fixture.turnId);
  for (const call of base.calls) idMap.set(call.id, `${fixture.id}:${call.id}`);
  for (const round of base.rounds) idMap.set(round.id, `${fixture.id}:${round.id}`);
  const remappedEvents = base.events.map(event => ({
    ...event,
    id: `${fixture.id}:${event.id}`,
    sessionId: fixture.id,
    turnId: fixture.turnId,
    callId: event.callId ? idMap.get(event.callId) : undefined,
    roundId: event.roundId ? idMap.get(event.roundId) : undefined,
    input: remapValue(event.input, idMap) as Record<string, unknown> | undefined,
    output: remapValue(event.output, idMap) as Record<string, unknown> | undefined,
  }));
  const full: RuntimeSession = {
    ...base,
    id: fixture.id,
    turnId: fixture.turnId,
    provider: fixture.provider,
    model: fixture.model,
    calls: base.calls.map(call => ({ ...call, id: idMap.get(call.id)!, roundId: idMap.get(call.roundId)!, retryOf: call.retryOf ? idMap.get(call.retryOf) : undefined })),
    rounds: base.rounds.map(round => ({ ...round, id: idMap.get(round.id)!, callIds: round.callIds.map(id => idMap.get(id)!), consumedCallIds: round.consumedCallIds.map(id => idMap.get(id)!) })),
    events: remappedEvents,
    dataSource: "mock",
  };
  return projectPrototypeSession(full, remappedEvents.filter(event => event.offsetMs <= fixture.visibleThroughMs));
}
