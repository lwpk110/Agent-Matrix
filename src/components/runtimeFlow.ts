import type { MockRuntimeEvent, MockNodeId } from "./codexRuntimeMock";

export type RuntimeFlow = { from: MockNodeId; to: MockNodeId };

/** Visualize observable transfers; waiting and lifecycle-only records have no traffic. */
export function runtimeFlow(event?: MockRuntimeEvent): RuntimeFlow | undefined {
  if (!event || event.status === "waiting" || event.status === "failed") return;
  if (event.name === "UserPromptSubmit") return { from: "input", to: "context" };
  if (event.name === "context.snapshot") return { from: "context", to: "prompt" };
  if (event.name === "model.request") return { from: "prompt", to: "model" };
  if (event.name === "model.tool_call") return { from: "model", to: "hook" };
  if (event.name === "PreToolUse") return { from: "hook", to: "gate" };
  if (event.name === "skill.reference.loaded") return { from: "skill", to: "model" };
  if (event.name === "tool.started" && (event.node === "tool" || event.node === "mcp")) {
    return { from: "gate", to: event.node };
  }
  if (event.name === "tool.completed" && (event.node === "tool" || event.node === "mcp")) {
    return { from: event.node, to: "model" };
  }
  if (event.node === "output") return { from: "model", to: "output" };
}
