import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createCodexRuntimeMock } from "./codexRuntimeMock";
import { runtimeFlow } from "./runtimeFlow";
import { RUNTIME_EDGES } from "./codex3d/model";

const events = createCodexRuntimeMock().events;
test("every animated transfer exists in the runtime topology", () => {
  for (const event of events) {
    const flow = runtimeFlow(event);
    if (flow) assert.ok(RUNTIME_EDGES.some(edge => edge.from === flow.from && edge.to === flow.to), event.name);
  }
});
test("approval waits and failed executions never show successful traffic", () => {
  const stopped = events.filter(event => event.status === "waiting" || event.status === "failed");
  assert.ok(stopped.length > 0);
  stopped.forEach(event => assert.equal(runtimeFlow(event), undefined));
});
test("MCP results flow back into the model, while starts flow out of the gate", () => {
  const start = events.find(event => event.node === "mcp" && event.name === "tool.started");
  const finish = events.find(event => event.node === "mcp" && event.name === "tool.completed");
  assert.deepEqual(runtimeFlow(start), { from: "gate", to: "mcp" });
  assert.deepEqual(runtimeFlow(finish), { from: "mcp", to: "model" });
});

test("real Codex runtime events animate only their observed transfer direction", () => {
  const base = events[0];
  const observed = (name: string, node: typeof base.node, status: typeof base.status) => ({ ...base, name, node, status });

  assert.deepEqual(runtimeFlow(observed("AppServerCommandExecution", "tool", "running")), { from: "model", to: "tool" });
  assert.deepEqual(runtimeFlow(observed("AppServerCommandExecution", "tool", "completed")), { from: "tool", to: "model" });
  assert.deepEqual(runtimeFlow(observed("AppServerMcpToolCall", "mcp", "running")), { from: "model", to: "mcp" });
  assert.deepEqual(runtimeFlow(observed("AppServerWebSearch", "search", "completed")), { from: "search", to: "model" });
  assert.deepEqual(runtimeFlow(observed("SessionStart", "context", "completed")), undefined);
  assert.deepEqual(runtimeFlow(observed("AppServerCommandExecution", "tool", "waiting")), undefined);
});
