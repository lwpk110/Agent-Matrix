import assert from "node:assert/strict";
import test from "node:test";
import type { LogEntry } from "../types/matrix";
import { createRuntimeSessionFromLogs, createRuntimeSessionsFromLogs, findRuntimePluginByPath, getRuntimeConnection, getRuntimePlugin, registerRuntimePlugin } from "./runtimePlugins";

function entry(provider: string, id: string, name: string, extra: Partial<NonNullable<LogEntry["runtimeEvent"]>> = {}): LogEntry {
  return {
    id,
    timestamp: `2026-10-20T00:00:0${id}.000Z`,
    agentTag: `${provider.toUpperCase()} LIVE`, agentColor: "cyan", category: "system", message: name,
    runtimeEvent: {
      provider, source: provider === "claude" ? "claude-hook" : "codex-hook", eventId: id, eventName: name,
      sessionId: "shared", turnId: "turn", phase: name === "UserPromptSubmit" ? "prompt" : "completed",
      hasToolResponse: false, details: JSON.stringify({ prompt: name === "UserPromptSubmit" ? `${provider} prompt` : undefined }), ...extra,
    },
  };
}

test("plugins project only their provider even when session, turn and call identifiers match", () => {
  const logs = [
    entry("codex", "1", "UserPromptSubmit"),
    entry("claude", "2", "UserPromptSubmit"),
    entry("claude", "3", "PostToolUseFailure", { toolUseId: "call" }),
  ];
  const session = createRuntimeSessionFromLogs(getRuntimePlugin("claude"), logs);
  assert.ok(session);
  assert.equal(session.provider, "claude");
  assert.equal(session.events.length, 2);
  assert.equal(session.events.find(event => event.name === "PostToolUseFailure")?.status, "failed");
});

test("projects each provider session independently and orders the fleet by latest event", () => {
  const older = entry("codex", "1", "UserPromptSubmit", { sessionId: "session-older", turnId: "turn-old", timestamp: "2026-10-20T00:00:01.000Z" });
  const newer = entry("codex", "2", "UserPromptSubmit", { sessionId: "session-newer", turnId: "turn-new", timestamp: "2026-10-20T00:00:02.000Z" });
  const otherProvider = entry("claude", "3", "SessionStart", { sessionId: "session-claude", turnId: "turn-claude", timestamp: "2026-10-20T00:00:03.000Z" });
  const sessions = createRuntimeSessionsFromLogs(getRuntimePlugin("codex"), [older, newer, otherProvider]);
  assert.deepEqual(sessions.map(session => session.id), ["session-newer", "session-older"]);
  assert.equal(sessions[0].turnId, "turn-new");
  assert.deepEqual(sessions.map(session => session.events.map(event => event.sessionId)), [["session-newer"], ["session-older"]]);
});

test("a registered third-party plugin drives projection without renderer changes", () => {
  registerRuntimePlugin({
    provider: "test-agent", label: "Test", paths: { runtime: "/test/runtime", twoDimensional: "/test", threeDimensional: "/test/3d" },
    accepts: log => log.runtimeEvent?.provider === "test-agent" && log.runtimeEvent.eventName === "Synthetic",
    sourceLabel: () => "Test Agent Gateway",
    mapEvent: ({ log, base }) => ({ ...base, provider: "test-agent", title: `Test ${log.runtimeEvent!.eventName}` }),
  });
  const synthetic = entry("test-agent", "4", "Synthetic");
  const session = createRuntimeSessionFromLogs(getRuntimePlugin("test-agent"), [synthetic]);
  assert.equal(session?.provider, "test-agent");
  assert.equal(session?.events[0].title, "Test Synthetic");
  assert.equal(session?.events[0].source, "Test Agent Gateway");
  assert.equal(findRuntimePluginByPath("/test/3d")?.provider, "test-agent");
});

test("connection status belongs to each plugin and is absent for plugins without a contract", () => {
  const status = {
    codexHookGatewayState: "offline",
    codexHookPort: 7789,
    codexAppServerState: "listening",
    claudeHookGatewayState: "listening",
    claudeHookPort: 7788,
  } as unknown as import("../types/matrix").RealSystemStatus;
  assert.deepEqual(getRuntimeConnection(getRuntimePlugin("codex"), status), {
    hookGatewayState: "offline", hookPort: 7789, appServerState: "listening",
  });
  assert.deepEqual(getRuntimeConnection(getRuntimePlugin("claude"), status), {
    hookGatewayState: "listening", hookPort: 7788,
  });
  assert.deepEqual(getRuntimeConnection(getRuntimePlugin("test-agent"), status), {});
  assert.equal(findRuntimePluginByPath("/test/runtime")?.provider, "test-agent");
});

test("Claude maps MCP, compaction, subagents and final output without ending the main turn early", () => {
  const logs = [
    entry("claude", "5", "UserPromptSubmit"),
    entry("claude", "6", "PreToolUse", { toolName: "mcp__docs__search", toolUseId: "shared-call", phase: "started" }),
    entry("claude", "7", "PreCompact"),
    entry("claude", "8", "SubagentStop", { details: JSON.stringify({ last_assistant_message: "子代理答复" }) }),
    entry("claude", "9", "Stop", { details: JSON.stringify({ last_assistant_message: "主回合最终答复" }) }),
  ];
  const session = createRuntimeSessionFromLogs(getRuntimePlugin("claude"), logs);
  assert.ok(session);
  assert.equal(session.events.find(event => event.id === "6")?.node, "mcp");
  assert.equal(session.events.find(event => event.id === "7")?.node, "context");
  assert.equal(session.events.find(event => event.id === "8")?.node, "context");
  assert.equal(session.finalAnswer, "主回合最终答复");
});

test("keeps provider-scoped session metadata when a later event omits it", () => {
  const session = createRuntimeSessionFromLogs(getRuntimePlugin("claude"), [
    entry("claude", "a", "SessionStart", { model: "claude-sonnet", cwd: "/workspace" }),
    entry("claude", "b", "Stop", { details: JSON.stringify({ last_assistant_message: "done" }) }),
  ]);
  assert.equal(session?.model, "claude-sonnet");
  assert.equal(session?.cwd, "/workspace");
});

test("uses telemetry duration without inventing model rounds", () => {
  const first = entry("claude", "1", "SessionStart"); const last = entry("claude", "2", "Stop");
  first.runtimeEvent!.timestamp = "2026-10-20T00:00:00.000Z"; last.runtimeEvent!.timestamp = "2026-10-20T00:00:01.500Z";
  const session = createRuntimeSessionFromLogs(getRuntimePlugin("claude"), [first, last], { modelRequestCount: 3, durationMs: 99 });
  assert.equal(session?.durationMs, 99);
  assert.equal(session?.rounds.length, 0);
});

test("keeps redacted per-request telemetry separate from lifecycle model rounds", () => {
  const session = createRuntimeSessionFromLogs(getRuntimePlugin("claude"), [entry("claude", "a", "SessionStart")], {
    modelRequestCount: 3,
    requests: [
      { inputTokens: 120, cachedInputTokens: 70, outputTokens: 20, reasoningTokens: null },
      { inputTokens: null, cachedInputTokens: null, outputTokens: 8, reasoningTokens: null },
    ],
  });
  assert.equal(session?.rounds.length, 0);
  assert.deepEqual(session?.rolloutTelemetry?.requests, [
    { inputTokens: 120, cachedInputTokens: 70, outputTokens: 20, reasoningTokens: null },
    { inputTokens: null, cachedInputTokens: null, outputTokens: 8, reasoningTokens: null },
  ]);
});

test("Claude visual contract supplies a branded core glyph and telemetry is marked as request-derived", () => {
  const plugin = getRuntimePlugin("claude");
  assert.equal(plugin.visual?.coreIcon, "claude-mark");
  assert.equal(plugin.capabilities?.promptTelemetry, true);
  const session = createRuntimeSessionFromLogs(plugin, [entry("claude", "a", "SessionStart", { model: "hook-model" })], { model: "request-model", modelRequestCount: 2 });
  assert.equal(session?.model, "request-model");
  assert.equal(session?.rolloutTelemetry?.modelSource, "request-statistics");
});

test("Claude projects transcript-only tool metadata without arguments or result bodies", () => {
  const session = createRuntimeSessionFromLogs(getRuntimePlugin("claude"), [entry("claude", "a", "SessionStart")], {
    toolCallMetadata: [{ callId: "call-safe", name: "Bash", resultObserved: true, isError: null, observedAt: "2026-10-21T10:00:00.000Z" }],
    contextMetadata: { instructionFileCount: 2, observedAt: "2026-10-21T10:00:00.000Z", source: "claude-transcript", scope: "turn" },
    promptMetadata: { systemSegmentCount: 3, toolDefinitionCount: 4, observedAt: "2026-10-21T10:00:00.000Z", source: "claude-transcript", scope: "turn" },
  });
  assert.deepEqual(session?.calls[0] && { id: session.calls[0].id, name: session.calls[0].name, arguments: session.calls[0].arguments, result: session.calls[0].result, metadataOnly: session.calls[0].metadataOnly, resultReceived: session.calls[0].resultReceived, resultError: session.calls[0].resultError }, { id: "call-safe", name: "Bash", arguments: {}, result: {}, metadataOnly: true, resultReceived: true, resultError: null });
});

test("Claude transcript metadata classifies MCP/search tools and preserves Hook terminal fields", () => {
  const session = createRuntimeSessionFromLogs(getRuntimePlugin("claude"), [
    entry("claude", "h1", "PreToolUse", { toolName: "mcp__docs__search", toolUseId: "call-merge", phase: "started" }),
    entry("claude", "h2", "PostToolUseFailure", { toolName: "mcp__docs__search", toolUseId: "call-merge", phase: "completed", hasToolResponse: true }),
  ], { toolCallMetadata: [{ callId: "call-merge", name: "mcp__docs__search", resultObserved: false, isError: null, observedAt: "2026-10-21T10:00:02.000Z" }, { callId: "call-search", name: "WebSearch", resultObserved: false, isError: null, observedAt: null }] });
  const merged = session?.calls.find(call => call.id === "call-merge");
  assert.equal(merged?.status, "failed");
  assert.equal(merged?.resultReceived, true);
  assert.equal(merged?.type, "mcp");
  assert.notEqual(merged?.metadataOnly, true);
  assert.equal(session?.calls.find(call => call.id === "call-search")?.type, "mcp");
});

test("keeps Claude tool identity and terminal state when a late start arrives", () => {
  const session = createRuntimeSessionFromLogs(getRuntimePlugin("claude"), [
    entry("claude", "c", "PostToolUse", { toolName: "mcp__docs__search", toolUseId: "call-c", hasToolResponse: true }),
    entry("claude", "d", "PreToolUse", { toolName: "mcp__docs__search", toolUseId: "call-c", phase: "started" }),
  ]);
  assert.equal(session?.calls[0].name, "mcp__docs__search");
  assert.equal(session?.calls[0].status, "completed");
});

test("keeps an observed tool response when its started event arrives late", () => {
  registerRuntimePlugin({
    provider: "late-agent", label: "Late Agent", paths: { runtime: "/late/runtime", twoDimensional: "/late", threeDimensional: "/late/3d" },
    accepts: log => log.runtimeEvent?.provider === "late-agent",
    mapEvent: ({ base }) => base,
  });
  const completed = entry("late-agent", "x", "PostToolUse", { toolName: "Bash", toolUseId: "call-late", hasToolResponse: true });
  const started = entry("late-agent", "y", "PreToolUse", { toolName: "Bash", toolUseId: "call-late", phase: "started" });
  completed.runtimeEvent!.timestamp = "2026-10-20T00:00:01.000Z";
  started.runtimeEvent!.timestamp = "2026-10-20T00:00:02.000Z";
  const session = createRuntimeSessionFromLogs(getRuntimePlugin("late-agent"), [completed, started]);
  assert.equal(session?.calls[0].resultReceived, true);
  assert.equal(session?.calls[0].status, "completed");
});
