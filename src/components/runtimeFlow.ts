import type { RuntimeEvent, RuntimeNodeId } from "../types/runtime";

export type RuntimeFlow = { from: RuntimeNodeId; to: RuntimeNodeId };

/** Visualize observable transfers; waiting and lifecycle-only records have no traffic. */
export function runtimeFlow(event?: RuntimeEvent): RuntimeFlow | undefined {
  if (!event || event.status === "waiting" || event.status === "failed") return;
  if (event.flow) return event.flow;
  if (event.name === "UserPromptSubmit") return { from: "input", to: "context" };
  if (event.name === "context.snapshot") return { from: "context", to: "prompt" };
  if (event.name === "model.request") return { from: "prompt", to: "model" };
  if (event.name === "model.tool_call") return { from: "model", to: "hook" };
  if (event.name === "PreToolUse") return { from: "hook", to: "gate" };
  if (event.name === "PostToolUse") return { from: event.node === "mcp" ? "mcp" : "tool", to: "model" };
  if (event.name === "skill.reference.loaded") return { from: "skill", to: "model" };
  if (event.name === "SkillActivated") return { from: "skill", to: "model" };
  if (event.name === "AppServerWebSearch") return event.status === "completed" ? { from: "search", to: "model" } : undefined;
  if (event.name === "AppServerFinalAnswer") return event.status === "completed" ? { from: "model", to: "output" } : undefined;
  if (event.name === "AppServerCommandExecution" || event.name === "AppServerDynamicToolCall" || event.name === "AppServerMcpToolCall") {
    const node = event.name === "AppServerMcpToolCall" ? "mcp" : event.name === "AppServerCommandExecution" ? "tool" : event.node;
    if (node !== "tool" && node !== "mcp") return;
    if (event.status === "running") return { from: "model", to: node };
    if (event.status === "completed") return { from: node, to: "model" };
    return;
  }
  if (event.name === "tool.started" && (event.node === "tool" || event.node === "mcp")) {
    return { from: "gate", to: event.node };
  }
  if (event.name === "tool.completed" && (event.node === "tool" || event.node === "mcp")) {
    return { from: event.node, to: "model" };
  }
  if (event.node === "output") return { from: "model", to: "output" };
}
