import assert from "node:assert/strict";
import test from "node:test";
import { createCodexRuntimeSessionFromLogs } from "./codexRuntimeAdapter";
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
