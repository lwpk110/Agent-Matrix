import assert from "node:assert/strict";
import test from "node:test";
import type { LogEntry, WsConnectionState } from "../types/matrix";
import { codexCoreStatus } from "./codexCoreStatus";
import { getRuntimePlugin, registerRuntimePlugin } from "../services/runtimePlugins";

function event(id: string, name: string, payload: Record<string, unknown> = {}, turnId = "turn-a"): LogEntry {
  return {
    id,
    timestamp: "12:00:00",
    agentTag: "CODEX",
    agentColor: "cyan",
    category: "system",
    message: name,
    runtimeEvent: {
      provider: "codex",
      source: "codex-hook",
      eventId: id,
      eventName: name,
      sessionId: "session-a",
      turnId,
      phase: "lifecycle",
      hasToolResponse: false,
      timestamp: "2026-10-19T12:00:00.000Z",
      details: JSON.stringify(payload),
    },
  };
}

const base = (logs: LogEntry[], overrides: Partial<Parameters<typeof codexCoreStatus>[0]> = {}) => codexCoreStatus({
  logs,
  sessionId: "session-a",
  turnId: "turn-a",
  connectionState: "connected" as WsConnectionState,
  now: Date.parse("2026-10-19T12:00:01.000Z"),
  ...overrides,
});

test("signals active and recently completed context compaction", () => {
  assert.equal(base([event("1", "PreCompact")]).state, "compacting");
  assert.equal(base([event("1", "PreCompact"), event("2", "PostCompact")]).state, "compacted");
  assert.equal(base([event("1", "PreCompact")], { now: Date.parse("2026-10-19T12:02:00.000Z") }).state, "warning");
});

test("shows a completed turn rather than an active core after Stop", () => {
  const status = base([event("1", "Stop")]);
  assert.equal(status.label, "回合已完成");
});

test("marks context capacity and observed execution/network failures", () => {
  const telemetry = { contextWindowTokens: 100, latestRequest: { inputTokens: 97, cachedInputTokens: null, outputTokens: null, reasoningTokens: null } } as NonNullable<Parameters<typeof codexCoreStatus>[0]["telemetry"]>;
  assert.equal(base([], { telemetry }).state, "warning");
  assert.equal(base([], { telemetry: { ...telemetry, latestRequest: { ...telemetry.latestRequest!, inputTokens: 101 } } }).state, "error");
  assert.equal(base([event("1", "AppServerCommandExecution", { exitCode: 2, stderr: "failed" })]).state, "error");
  assert.equal(base([event("1", "AppServerCommandExecution", { status: "failed", error: "API quota exceeded" })]).label, "额度或上下文超限");
  assert.equal(base([], { connectionState: "offline" }).label, "网络连接异常");
});

test("clears an execution error after an observed successful retry", () => {
  const logs = [
    event("1", "AppServerCommandExecution", { exitCode: 2, status: "completed" }),
    event("2", "AppServerCommandExecution", { exitCode: 0, status: "completed" }),
  ];
  assert.equal(base(logs).state, "normal");
});

test("isolates providers and lets a later Stop clear an older PreCompact", () => {
  const compact = event("1", "PreCompact");
  const stop = event("2", "Stop");
  stop.runtimeEvent!.timestamp = "2026-10-19T12:00:02.000Z";
  const claude = event("3", "PreCompact");
  claude.runtimeEvent = { ...claude.runtimeEvent!, provider: "claude" };
  assert.equal(base([compact, stop, claude], { provider: "codex" }).state, "normal");
});

test("plugin identity isolates core state when session and turn IDs overlap", () => {
  const failure = event("1", "PostToolUseFailure");
  failure.runtimeEvent!.provider = "claude";
  const otherStop = event("2", "Stop");
  otherStop.runtimeEvent!.timestamp = "2026-10-19T12:00:02.000Z";
  assert.equal(base([failure, otherStop], { plugin: getRuntimePlugin("claude") }).state, "error");
});

test("does not apply Codex connection state to a third-party provider", () => {
  registerRuntimePlugin({
    provider: "status-test-agent",
    label: "Status Test Agent",
    paths: { runtime: "/status-test/runtime", twoDimensional: "/status-test", threeDimensional: "/status-test/3d" },
    accepts: () => false,
    mapEvent: ({ base }) => base,
  });
  assert.equal(base([], {
    provider: "status-test-agent",
    realStatus: { codexHookGatewayState: "offline", codexAppServerState: "offline" } as never,
  }).state, "normal");
});
