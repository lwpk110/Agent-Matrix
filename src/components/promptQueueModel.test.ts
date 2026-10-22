import assert from "node:assert/strict";
import test from "node:test";
import type { LogEntry } from "../types/matrix";
import { promptObservations, promptTraces } from "./promptQueueModel";

function log(id: string, eventName: string, turnId: string, phase: NonNullable<LogEntry["runtimeEvent"]>["phase"], payload: Record<string, unknown>): LogEntry {
  return {
    id,
    timestamp: `2026-10-19T00:00:0${id}.000Z`,
    agentTag: "CODEX",
    agentColor: "cyan",
    category: "system",
    message: eventName,
    runtimeEvent: {
      provider: "codex",
      source: "codex-app-server",
      eventId: id,
      eventName,
      sessionId: "session-a",
      turnId,
      phase,
      hasToolResponse: false,
      details: JSON.stringify(payload),
    },
  };
}

test("tracks received, processing and completed prompts from observed events", () => {
  const traces = promptTraces([
    log("1", "UserPromptSubmit", "turn-a", "prompt", { prompt: "First task" }),
    log("2", "AppServerCommandExecution", "turn-a", "completed", { command: "npm test" }),
    log("3", "AppServerFinalAnswer", "turn-a", "completed", { text: "Done" }),
    log("4", "UserPromptSubmit", "turn-b", "prompt", { prompt: "Second task" }),
    log("5", "AppServerCommandExecution", "turn-b", "started", { command: "npm run build" }),
    log("6", "UserPromptSubmit", "turn-c", "prompt", { prompt: "Third task" }),
  ], "session-a");

  assert.deepEqual(traces.map(trace => trace.status), ["received", "processing", "completed"]);
  assert.deepEqual(traces.map(trace => trace.prompt), ["Third task", "Second task", "First task"]);
});

test("does not mix prompts from other sessions and bounds the recent list", () => {
  const logs = Array.from({ length: 4 }, (_, index) => log(String(index + 1), "UserPromptSubmit", `turn-${index}`, "prompt", { prompt: `Task ${index}` }));
  logs[3].runtimeEvent!.sessionId = "session-b";
  assert.deepEqual(promptTraces(logs, "session-a", 2).map(trace => trace.prompt), ["Task 2", "Task 1"]);
});

test("merges matching Hook and app-server prompt reports within the same turn", () => {
  const appPrompt = log("1", "UserPromptSubmit", "turn-a", "prompt", { prompt: "Same prompt" });
  appPrompt.timestamp = "2026-10-19T00:00:01.000Z";
  const hookPrompt = log("2", "UserPromptSubmit", "turn-a", "prompt", { prompt: "Same prompt" });
  hookPrompt.runtimeEvent!.source = "codex-hook";
  hookPrompt.timestamp = "2026-10-19T00:02:02.000Z";
  const traces = promptTraces([appPrompt, hookPrompt], "session-a");

  assert.equal(traces.length, 1);
  assert.equal(traces[0].prompt, "Same prompt");
  assert.equal(traces[0].status, "received");
});

test("filters a shared session and turn by provider", () => {
  const codex = log("7", "UserPromptSubmit", "turn-a", "prompt", { prompt: "Codex prompt" });
  const claude = log("8", "UserPromptSubmit", "turn-a", "prompt", { prompt: "Claude prompt" });
  claude.runtimeEvent = { ...claude.runtimeEvent!, provider: "claude", source: "claude-hook" };
  assert.deepEqual(promptTraces([codex, claude], "session-a", "turn-a", "codex").map(trace => trace.prompt), ["Codex prompt"]);
});

test("projects Claude prompt lifecycle metadata without retaining prompt content", () => {
  const submitted = log("metadata-prompt", "UserPromptSubmit", "turn-a", "prompt", { prompt: "不得展示的提示词正文" });
  submitted.runtimeEvent = { ...submitted.runtimeEvent!, provider: "claude", source: "claude-hook" };
  submitted.timestamp = "2026-10-21T10:00:00.000Z";
  const completed = log("metadata-stop", "Stop", "turn-a", "completed", {});
  completed.runtimeEvent = { ...completed.runtimeEvent!, provider: "claude", source: "claude-hook" };
  const observations = promptObservations([submitted, completed], "session-a", "turn-a", "claude");
  assert.deepEqual(observations, [{ id: "metadata-prompt", turnId: "turn-a", timestamp: "2026-10-21T10:00:00.000Z", status: "completed", evidence: "UserPromptSubmit -> Stop" }]);
  assert.doesNotMatch(JSON.stringify(observations), /不得展示的提示词正文/);
});
