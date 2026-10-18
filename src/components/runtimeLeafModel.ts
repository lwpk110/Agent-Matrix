import type { MockNodeId, MockRuntimeEvent, MockRuntimeSession } from "./codexRuntimeMock";

export type LeafStatus = "available" | "loaded" | "completed" | "running" | "waiting" | "failed";
export type RuntimeLeaf = {
  id: string;
  title: string;
  name: string;
  summary: string;
  status: LeafStatus;
  icon: string;
  eventId?: string;
  callId?: string;
};

export const leafStatusLabels: Record<LeafStatus, string> = {
  available: "可用 · 未加载", loaded: "本轮已加载", completed: "已完成",
  running: "执行中", waiting: "尚未发生", failed: "执行失败",
};

/** Expand a category into its own members, using only events visible at this replay position. */
export function runtimeLeaves(node: MockNodeId, session: MockRuntimeSession, events: MockRuntimeEvent[]): RuntimeLeaf[] {
  if (session.isReal) {
    const statusOf = (status: MockRuntimeEvent["status"]): LeafStatus => status === "allowed" ? "completed"
      : status === "unknown" ? "waiting" : status;
    if (["tool", "mcp", "search"].includes(node)) {
      const ids = [...new Set(events.filter(event => event.node === node && event.callId).map(event => event.callId!))];
      return ids.map(id => {
        const observed = events.filter(event => event.node === node && event.callId === id);
        const lastEvent = observed.at(-1)!;
        const call = session.calls.find(item => item.id === id);
        return {
          id, title: call?.title || lastEvent.title, name: call?.name || lastEvent.name,
          summary: call?.resultReceived ? `${lastEvent.summary} 已采集到返回字段。` : lastEvent.summary,
          status: statusOf(call?.status || lastEvent.status),
          icon: node === "tool" ? "terminal" : node === "search" ? "search" : "network",
          eventId: lastEvent.id, callId: id,
        };
      });
    }
    return events.filter(event => event.node === node).map(event => ({
      id: event.id,
      title: event.title,
      name: event.name,
      summary: event.summary,
      status: statusOf(event.status),
      icon: node === "skill" ? "book" : node === "gate" ? "shield" : node === "hook" ? "zap" : node === "input" ? "message" : node === "context" ? "layers" : node === "output" ? "message" : "sparkles",
      eventId: event.id,
      callId: event.callId,
    }));
  }
  const last = (name: string, callId?: string) => events.filter(event => event.name === name && (!callId || event.callId === callId)).at(-1);
  const entry = (id: string, title: string, name: string, summary: string, icon: string, eventName: string): RuntimeLeaf => {
    const event = last(eventName);
    return { id, title, name, summary, icon, eventId: event?.id, status: event ? "completed" : "waiting" };
  };
  const callLeaf = (call: MockRuntimeSession["calls"][number]): RuntimeLeaf => {
    const observed = events.filter(event => event.callId === call.id);
    const terminal = observed.find(event => event.name === "tool.completed" || event.name === "tool.failed");
    return {
      id: call.id, title: call.title, name: call.name, icon: call.type === "mcp" ? "network" : "terminal",
      summary: terminal ? `${call.title}${call.durationMs === null ? "" : `，耗时 ${call.durationMs} ms`}。${call.status === "failed" ? "本次调用失败。" : call.resultReceived === false ? "完成事件未包含返回值。" : "已收到调用完成事件。"}` : `${call.title}。${call.status === "running" ? "工具正在执行。" : "回放尚未执行到这次调用。"}`,
      status: terminal ? call.status === "unknown" ? "waiting" : call.status : call.status === "running" || observed.some(event => event.name === "tool.started") ? "running" : "waiting",
      callId: observed.length ? call.id : undefined,
      eventId: terminal?.id ?? observed.at(-1)?.id,
    };
  };
  switch (node) {
    case "skill": return session.skillCatalog.map(skill => {
      const event = events.find(event => event.name === "skill.reference.loaded" && event.input?.name === skill.id);
      return { ...skill, name: skill.id, summary: skill.description, status: event ? "loaded" : "available", eventId: event?.id };
    });
    case "tool": return session.calls.filter(call => call.type === "local").map(callLeaf);
    case "search": return session.calls.filter(call => call.id === "call_files_01" || call.id === "call_docs_04").map(callLeaf);
    case "mcp": return ["documentation", "browser"].map(server => {
      const calls = session.calls.filter(call => call.name.startsWith(`${server}.`));
      const observed = events.filter(event => calls.some(call => call.id === event.callId));
      const terminal = observed.filter(event => event.name === "tool.completed" || event.name === "tool.failed").at(-1);
      const latestExecution = observed.filter(event => ["tool.started", "tool.completed", "tool.failed"].includes(event.name)).at(-1);
      return {
        id: server, title: server === "browser" ? "浏览器服务" : "文档服务", name: server,
        icon: server === "browser" ? "browser" : "book",
        summary: `${server === "browser" ? "inspect_page：检查本地页面，支持超时重试。" : "search：查询 React 官方文档，需先获得联网许可。"} 计划 ${calls.length} 次调用，当前可见 ${observed.filter(event => event.name === "tool.started").length} 次执行。`,
        status: latestExecution?.name === "tool.started" ? "running" : terminal ? terminal.status === "failed" ? "failed" : "completed" : "waiting",
        eventId: latestExecution?.id ?? observed.at(-1)?.id,
      };
    });
    case "model": return session.rounds.map((round, index) => {
      const request = events.find(event => event.name === "model.request" && event.roundId === round.id);
      const response = events.find(event => event.name === "model.response.completed" && event.roundId === round.id);
      return {
        id: round.id, title: `第 ${index + 1} 轮请求`, name: round.id, icon: "sparkles",
        summary: request ? `${round.response}${response ? ` 输入 ${round.inputTokens}、输出 ${round.outputTokens} token。` : " 当前请求尚未结束。"}` : "此轮请求尚未发生。",
        status: response ? "completed" : request ? "running" : "waiting", eventId: response?.id ?? request?.id,
      };
    });
    case "hook": return [
      entry("session", "会话启动", "SessionStart", "建立会话标识并记录工作目录。", "layers", "SessionStart"),
      entry("pre", "执行前", "PreToolUse", "记录工具名称、输入和调用标识。", "zap", "PreToolUse"),
      entry("post", "执行后", "PostToolUse", "记录成功结果，与执行前事件配对。", "check", "PostToolUse"),
      entry("failure", "执行失败", "PostToolUseFailure", "记录失败原因，供后续模型请求处理。", "alert", "PostToolUseFailure"),
      entry("stop", "回合结束", "Stop", "记录最终响应结束和回合状态。", "check", "Stop"),
    ];
    case "context": return [
      entry("workspace", "工作区", "Agent-Matrix", session.cwd, "folder", "context.snapshot"),
      entry("history", "会话历史", "0 个历史回合", "此演示从新回合开始，没有历史消息。", "message", "context.snapshot"),
      entry("constraints", "用户约束", "只读 / 联网先确认", "不修改文件，外部联网前征得用户确认。", "shield", "context.snapshot"),
      entry("definitions", "能力定义", "本地工具 + MCP", "一个本地工具和两个 MCP 服务提供可用工具定义。", "network", "capabilities.snapshot"),
      entry("results", "工具结果", "逐轮追加", "执行结果写回上下文，再次发送给模型。", "terminal", "context.tool_result"),
      entry("budget", "上下文预算", "32,768 tokens", "演示快照中的上下文预算；本轮未触发压缩。", "layers", "context.snapshot"),
    ];
    case "prompt": return [
      entry("instruction", "演示指令", "工作方法与边界", session.instruction, "book", "prompt.composition"),
      entry("message", "用户消息", "本轮任务", session.prompt, "message", "UserPromptSubmit"),
      entry("context", "上下文引用", "工作区 / 历史", "携带上下文快照和历史工具结果。", "layers", "prompt.composition"),
      entry("tools", "工具定义", "参数与可用能力", "工具名称与参数定义让模型能够生成工具调用。", "terminal", "capabilities.snapshot"),
    ];
    case "input": return [
      entry("task", "原始任务", "用户提示词", session.prompt, "message", "UserPromptSubmit"),
      entry("boundary", "操作边界", "不修改文件", "本轮只收集信息，不修改项目内容。", "shield", "UserPromptSubmit"),
      entry("network", "联网要求", "先征求确认", "查询外部资料前，需获得一次性联网许可。", "network", "UserPromptSubmit"),
    ];
    case "gate": return [
      entry("policy", "只读策略", "read-only", "执行前检查当前沙箱和操作边界。", "shield", "policy.decision"),
      entry("request", "联网审批", "一次性许可", "React 文档查询前先请求用户确认。", "network", "PermissionRequest"),
      entry("allow", "用户授权", "仅本次调用", "批准只适用于本次文档查询，不会扩展后续权限。", "check", "approval.decision"),
    ];
    case "output": return [
      entry("answer", "最终回答", "面向用户的结论", session.finalAnswer, "message", "assistant.message.completed"),
      entry("sources", "证据出处", "文件 + 官方文档", "README.md、package.json 与 React 官方文档支撑最终回答。", "book", "assistant.message.completed"),
      entry("completion", "回合状态", "等待新输入", "演示回合结束，会话可继续接收新任务。", "check", "turn.completed"),
    ];
  }
}
