import test from "node:test";
import assert from "node:assert/strict";
import { createCodexRuntimeMock, type MockNodeId } from "./codexRuntimeMock";
import { runtimeLeaves } from "./runtimeLeafModel";
import { createCodexRuntimeSessionFromLogs } from "./codexRuntimeAdapter";
import type { LogEntry } from "../types/matrix";

test("skill leaves are catalogue members and only the observed skill is loaded", () => {
  const session = createCodexRuntimeMock();
  const leaves = runtimeLeaves("skill", session, session.events);
  assert.deepEqual(leaves.map(leaf => leaf.id), session.skillCatalog.map(skill => skill.id));
  assert.deepEqual(leaves.filter(leaf => leaf.status === "loaded").map(leaf => leaf.id), ["browser-inspection"]);
  assert.ok(leaves.filter(leaf => leaf.status === "available").every(leaf => !leaf.eventId));
  assert.ok(runtimeLeaves("skill", session, []).every(leaf => leaf.status === "available"));
});

test("tool and model leaves do not claim completion before replay reaches their results", () => {
  const session = createCodexRuntimeMock();
  const start = session.events.findIndex(event => event.name === "tool.started");
  const events = session.events.slice(0, start + 1);
  const tool = runtimeLeaves("tool", session, events);
  assert.equal(tool[0].status, "running");
  assert.ok(tool.slice(1).every(leaf => leaf.status === "waiting"));
  assert.ok(runtimeLeaves("tool", session, []).every(leaf => leaf.status === "waiting" && !leaf.eventId && !leaf.callId));
  assert.ok(runtimeLeaves("model", session, []).every(leaf => leaf.status === "waiting" && !leaf.eventId));
});

test("MCP expands services and reflects a failed browser attempt followed by recovery", () => {
  const session = createCodexRuntimeMock();
  const failed = session.events.findIndex(event => event.name === "tool.failed");
  const browser = runtimeLeaves("mcp", session, session.events.slice(0, failed + 1)).find(leaf => leaf.id === "browser")!;
  assert.equal(browser.status, "failed");
  const retry = session.events.findIndex(event => event.name === "tool.started" && event.callId === "call_browser_06");
  assert.equal(runtimeLeaves("mcp", session, session.events.slice(0, retry + 1)).find(leaf => leaf.id === "browser")?.status, "running");
  const completed = runtimeLeaves("mcp", session, session.events);
  assert.deepEqual(completed.map(leaf => leaf.id), ["documentation", "browser"]);
  assert.ok(completed.every(leaf => leaf.status === "completed"));
});

test("every leaf evidence link points to a visible event or call", () => {
  const session = createCodexRuntimeMock();
  const ids: MockNodeId[] = ["input", "context", "prompt", "skill", "model", "hook", "gate", "tool", "mcp", "search", "output"];
  for (let end = 0; end <= session.events.length; end++) {
    const events = session.events.slice(0, end);
    for (const node of ids) {
      for (const leaf of runtimeLeaves(node, session, events)) {
        if (leaf.eventId) assert.ok(events.some(event => event.id === leaf.eventId), `${node}/${leaf.id}`);
        if (leaf.callId) assert.ok(events.some(event => event.callId === leaf.callId), `${node}/${leaf.id}`);
      }
    }
  }
});

test("live leaf topology contains only observed runtime records", () => {
  const timestamp = "2026-10-18T10:00:00.000Z";
  const log: LogEntry = {
    id: "live-call", timestamp, agentTag: "CODEX LIVE", agentColor: "cyan", category: "tool",
    message: "AppServerMcpToolCall",
    runtimeEvent: {
      provider: "codex", source: "codex-app-server", eventId: "live-event",
      eventName: "AppServerMcpToolCall", sessionId: "live-session", turnId: "live-turn",
      toolUseId: "call-live", toolName: "docs/search", phase: "started", timestamp,
      hasToolResponse: false, details: JSON.stringify({ server: "docs", tool: "search", status: "inProgress", arguments: { query: "React" } }),
    },
  };
  const session = createCodexRuntimeSessionFromLogs([log])!;
  const leaves = runtimeLeaves("mcp", session, session.events);

  assert.equal(session.isReal, true);
  assert.equal(leaves.length, 1);
  assert.equal(leaves[0].name, "docs/search");
  assert.equal(leaves[0].status, "running");
  assert.equal(runtimeLeaves("skill", session, session.events).length, 0);
});
