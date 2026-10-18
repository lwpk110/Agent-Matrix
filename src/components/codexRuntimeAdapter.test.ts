import assert from "node:assert/strict";
import test from "node:test";
import { createCodexRuntimeSessionFromLogs, latestObservedCodexEvent } from "./codexRuntimeAdapter";
import type { LogEntry } from "../types/matrix";

function log(id: string, sessionId: string, turnId: string, eventName: string, payload: Record<string, unknown>, extra: Partial<NonNullable<LogEntry["runtimeEvent"]>> = {}): LogEntry {
  return {
    id,
    timestamp: new Date(2026, 9, 18, 10, 0, Number(id)).toISOString(),
    agentTag: "CODEX LIVE",
    agentColor: "cyan",
    category: "system",
    message: eventName,
    runtimeEvent: {
      provider: "codex",
      source: "codex-app-server",
      eventId: id,
      eventName,
      sessionId,
      turnId,
      phase: "lifecycle",
      hasToolResponse: false,
      timestamp: new Date(2026, 9, 18, 10, 0, Number(id)).toISOString(),
      details: JSON.stringify(payload),
      ...extra,
    },
  };
}

test("adapts observed prompt, MCP and final answer events into a live session", () => {
  const session = createCodexRuntimeSessionFromLogs([
    log("1", "session-a", "turn-a", "UserPromptSubmit", { prompt: "检查项目" }, { phase: "prompt" }),
    log("2", "session-a", "turn-a", "AppServerMcpToolCall", { server: "docs", tool: "search", status: "completed", arguments: { query: "React" } }, { phase: "completed", toolUseId: "call-1", toolName: "docs/search" }),
    log("3", "session-a", "turn-a", "AppServerFinalAnswer", { text: "完成" }, { phase: "completed" }),
    log("0", "session-old", "turn-old", "UserPromptSubmit", { prompt: "旧回合" }, { phase: "prompt" }),
  ]);

  assert.ok(session);
  assert.equal(session.isReal, true);
  assert.equal(session.dataSource, "live");
  assert.equal(session.prompt, "检查项目");
  assert.equal(session.events.length, 3);
  assert.equal(session.events[1].node, "mcp");
  assert.equal(session.calls[0].id, "call-1");
  assert.equal(session.calls[0].name, "docs/search");
  assert.equal(session.finalAnswer, "完成");
  assert.equal(session.calls[0].resultReceived, false);
  assert.equal(session.usage.inputTokens, null);
  assert.equal(session.rounds.length, 0);
  assert.equal(session.model, "未采集");
  assert.equal(session.reasoningEffort, "未采集");
  assert.equal(session.isMock, false);
});

test("uses matching rollout telemetry for model, effort and turn token totals", () => {
  const session = createCodexRuntimeSessionFromLogs([
    log("40", "telemetry-session", "telemetry-turn", "UserPromptSubmit", { prompt: "检查 Token" }, { phase: "prompt" }),
  ], {
    sessionId: "telemetry-session",
    turnId: "telemetry-turn",
    model: "gpt-6.1-sol",
    reasoningEffort: "high",
    modelRequestCount: 2,
    turnUsage: { inputTokens: 7200, cachedInputTokens: 5100, outputTokens: 42, reasoningTokens: 16, totalTokens: 7242 },
    latestRequest: { inputTokens: 7100, cachedInputTokens: 5000, outputTokens: 42, reasoningTokens: 16 },
    contextWindowTokens: 258400,
  });

  assert.ok(session);
  assert.equal(session.model, "gpt-6.1-sol");
  assert.equal(session.reasoningEffort, "high");
  assert.equal(session.usage.inputTokens, 7200);
  assert.equal(session.usage.cachedInputTokens, 5100);
  assert.equal(session.usage.outputTokens, 42);
  assert.equal(session.rolloutTelemetry?.modelRequestCount, 2);
  assert.equal(session.rolloutTelemetry?.contextWindowTokens, 258400);
});

test("removes ambient browser metadata from the user-facing prompt", () => {
  const session = createCodexRuntimeSessionFromLogs([
    log("11", "session-ui", "turn-ui", "UserPromptSubmit", {
      prompt: '<in-app-browser-context source="ambient-ui-state">Current URL: http://localhost:3102/codex</in-app-browser-context>\n\n## My request:\n检查多 Session 历史。',
    }, { phase: "prompt" }),
  ]);

  assert.ok(session);
  assert.equal(session.prompt, "检查多 Session 历史。");
  assert.equal(session.events[0].summary, "检查多 Session 历史。");
  assert.deepEqual(session.events[0].input, { prompt: "检查多 Session 历史。" });
});

test("preserves running status and does not present call arguments as a result", () => {
  const session = createCodexRuntimeSessionFromLogs([
    log("10", "active", "turn-active", "AppServerMcpToolCall", {
      server: "docs", tool: "search", status: "inProgress", arguments: { query: "React" },
    }, { phase: "started", toolUseId: "call-running", toolName: "docs/search" }),
  ]);

  assert.ok(session);
  assert.equal(session.calls.length, 1);
  assert.equal(session.calls[0].status, "running");
  assert.deepEqual(session.calls[0].arguments, { query: "React" });
  assert.deepEqual(session.calls[0].result, {});
  assert.equal(session.calls[0].resultReceived, false);
  assert.equal(session.events[0].output, undefined);
});

test("selects the most recently observed session instead of the session with most events", () => {
  const logs = [
    ...Array.from({ length: 5 }, (_, index) => log(String(index + 1), "old", "turn-old", "PostToolUse", { tool_response: `old-${index}` }, { phase: "completed" })),
    log("20", "new", "turn-new", "UserPromptSubmit", { prompt: "最新会话" }, { phase: "prompt" }),
  ];
  const session = createCodexRuntimeSessionFromLogs(logs);

  assert.ok(session);
  assert.equal(session.id, "new");
  assert.equal(session.prompt, "最新会话");
  assert.equal(session.events.length, 1);
});

test("only exposes explicitly final answer events and maps observed result fields", () => {
  const session = createCodexRuntimeSessionFromLogs([
    log("30", "session-final", "turn-final", "assistant.message.delta", { text: "partial" }, { phase: "lifecycle" }),
    log("31", "session-final", "turn-final", "AppServerCommandExecution", {
      command: "npm test", status: "completed", exitCode: 0, durationMs: 840,
    }, { phase: "completed", toolUseId: "command-1", toolName: "Bash" }),
  ]);

  assert.ok(session);
  assert.equal(session.finalAnswer, "");
  assert.equal(session.events.find(event => event.name === "AppServerCommandExecution")?.input?.command, "npm test");
  assert.deepEqual(session.events.find(event => event.name === "AppServerCommandExecution")?.output, {
    stdout: undefined, stderr: undefined, exitCode: 0,
  });
  assert.equal(session.calls[0].durationMs, 840);
  assert.equal(session.calls[0].resultReceived, true);
});

test("returns no session when the gateway has no Codex events", () => {
  assert.equal(createCodexRuntimeSessionFromLogs([]), null);
});

test("selects the latest received event when app-server timestamps only identify turn start", () => {
  const prompt = log("20", "session-order", "turn-order", "UserPromptSubmit", { prompt: "Task" });
  const call = log("21", "session-order", "turn-order", "AppServerMcpToolCall", {
    server: "docs", tool: "search", status: "inProgress", arguments: { query: "React" },
  }, { phase: "started", toolUseId: "call-21", toolName: "docs/search" });
  call.runtimeEvent!.timestamp = "2026-10-18T09:00:00.000Z";
  prompt.runtimeEvent!.timestamp = "2026-10-18T10:00:00.000Z";
  const session = createCodexRuntimeSessionFromLogs([prompt, call]);

  assert.ok(session);
  assert.equal(session.events.at(-1)?.id, prompt.id);
  assert.equal(latestObservedCodexEvent(session, [prompt, call])?.id, call.id);
});

test("keeps the last real transfer cycling through lifecycle-only events and stops on failure", () => {
  const transfer = log("41", "session-flow", "turn-flow", "PostToolUse", { tool_response: "done" }, { phase: "completed" });
  const lifecycle = log("42", "session-flow", "turn-flow", "SessionStart", { source: "resume" }, { phase: "lifecycle" });
  const session = createCodexRuntimeSessionFromLogs([transfer, lifecycle]);

  assert.ok(session);
  assert.equal(latestObservedCodexEvent(session, [transfer, lifecycle])?.id, transfer.id);

  const failed = log("43", "session-flow", "turn-flow", "PostToolUse", { success: false, error: "denied" }, { phase: "completed" });
  const withFailure = createCodexRuntimeSessionFromLogs([transfer, lifecycle, failed]);
  assert.ok(withFailure);
  assert.equal(latestObservedCodexEvent(withFailure, [transfer, lifecycle, failed])?.status, "failed");
});
