/** A deterministic, fictional session for the interactive product prototype.
 * Events use a product-level schema; these are not captured Codex wire messages.
 */
import type { CodexRolloutTelemetry } from "../types/codexTelemetry";

export type MockNodeId =
  | "input"
  | "context"
  | "prompt"
  | "skill"
  | "model"
  | "hook"
  | "gate"
  | "tool"
  | "mcp"
  | "search"
  | "output";
export type MockKind = Exclude<MockNodeId, "output"> | "result";
export type MockStatus =
  | "completed"
  | "running"
  | "waiting"
  | "failed"
  | "allowed"
  | "unknown";
export interface MockRuntimeEvent {
  id: string;
  sessionId: string;
  turnId: string;
  offsetMs: number;
  time: string;
  name: string;
  kind: MockKind;
  node: MockNodeId;
  relatedNodes: MockNodeId[];
  source: "App Server" | "Hook" | "策略快照" | "上下文快照" | "演示用户" | "Codex App Server" | "Codex Hook";
  title: string;
  summary: string;
  status: MockStatus;
  callId?: string;
  roundId?: string;
  durationMs?: number;
  hasToolResponse?: boolean;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  content?: string;
}
export interface MockCall {
  id: string;
  roundId: string;
  name: string;
  type: "local" | "mcp";
  title: string;
  arguments: Record<string, unknown>;
  result: Record<string, unknown>;
  durationMs: number;
  status: "completed" | "running" | "waiting" | "failed" | "unknown";
  resultReceived?: boolean;
  retryOf?: string;
  approvalId?: string;
}
export interface MockRound {
  id: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  consumedCallIds: string[];
  callIds: string[];
  response: string;
}
export interface MockMemory {
  id: string;
  title: string;
  scope: "用户" | "项目";
  mode: "始终带入" | "按需读取";
  content: string;
  source: string;
  updatedAt: string;
}
export interface MockContextSnapshot {
  total: number;
  limit: number;
  basis: "mock-estimate";
  segments: { id: string; label: string; tokens: number }[];
  memoryIds: string[];
}
export const MOCK_USER_PROMPT =
  "介绍当前项目的架构，核对 React 官方文档，并检查本地 /codex 页面。联网前先征得我确认，不要修改文件。";
export const MOCK_SESSION_ID = "sess_demo_024";
export const MOCK_TURN_ID = "turn_08";
export const MOCK_CWD = "D:/workspace/github/Agent-Matrix";

/** Fictional capability catalogue, distinct from skills actually loaded by this turn. */
export const MOCK_SKILL_CATALOG = [
  { id: "browser-inspection", title: "页面检查", description: "检查页面结构、交互与控制台；超时后最多重试一次。", icon: "browser" },
  { id: "architecture-review", title: "架构分析", description: "梳理模块边界、入口和依赖关系。本轮未读取此指南。", icon: "layers" },
  { id: "docs-research", title: "文档检索", description: "检索资料并整理出处。本轮文档查询通过 MCP 执行，未加载此 Skill。", icon: "book" },
  { id: "test-validation", title: "测试验证", description: "选择验证范围、执行检查并汇总结果。本轮只读演示未加载此指南。", icon: "check" },
  { id: "git-workflow", title: "版本管理", description: "检查变更和准备提交。本轮未修改文件，也未加载此指南。", icon: "git" },
] as const;

export function createCodexRuntimeMock(prompt = MOCK_USER_PROMPT) {
  const model = "codex-demo-model";
  const reasoningEffort = "high";
  const instruction =
    "你是本次演示的代码助手。先收集证据，再回答；遵守只读限制；联网访问需要用户确认；不要把未执行的动作描述为已完成。";
  const skillText =
    "# Browser inspection（演示 Skill）\n1. 只访问用户指定的本地页面。\n2. 读取页面标题、DOM 和控制台错误。\n3. 超时可重试一次，并在回答中说明。\n4. 不提交表单，不更改页面业务数据。";
  const calls: MockCall[] = [
    {
      id: "call_files_01",
      roundId: "model_01",
      name: "exec_command",
      type: "local",
      title: "列出工作区文件",
      arguments: {
        cmd: 'rg --files -g "!node_modules" -g "!dist"',
        cwd: MOCK_CWD,
      },
      result: {
        exit_code: 0,
        stdout:
          "README.md\npackage.json\nserver.ts\nsrc/App.tsx\nsrc/components/CodexRuntimePage.tsx\nsrc/services/codexRuntime.ts\nsrc/services/codexAppServer.ts",
        stderr: "",
        truncated: false,
      },
      durationMs: 510,
      status: "completed",
    },
    {
      id: "call_read_02",
      roundId: "model_01",
      name: "exec_command",
      type: "local",
      title: "读取项目说明与依赖",
      arguments: {
        cmd: "Get-Content README.md -TotalCount 24; Get-Content package.json",
        cwd: MOCK_CWD,
      },
      result: {
        exit_code: 0,
        stdout:
          "# AGENT MATRIX · NEURAL TREE\nAI 智能体运行时控制平面与安全审计网关\nReact/Vite 前端展示运行链路；server.ts 提供 Express 服务与 WebSocket 事件广播。\nHook 网关与 Codex app-server 适配器汇入会话记录。\n\npackage.json（节选）\nreact: ^19.0.1\nvite: ^8.3.0\nexpress: ^4.21.2\nws: ^8.22.0\ndev: tsx server.ts",
        stderr: "",
        truncated: true,
      },
      durationMs: 400,
      status: "completed",
    },
    {
      id: "call_skill_03",
      roundId: "model_02",
      name: "exec_command",
      type: "local",
      title: "读取浏览器检查 Skill",
      arguments: {
        cmd: "Get-Content .codex/skills/browser-inspection/SKILL.md",
        cwd: MOCK_CWD,
      },
      result: { exit_code: 0, stdout: skillText, stderr: "" },
      durationMs: 320,
      status: "completed",
    },
    {
      id: "call_docs_04",
      roundId: "model_03",
      name: "documentation.search",
      type: "mcp",
      title: "查询 React 官方文档",
      arguments: {
        server: "documentation",
        tool: "search",
        query: "React 19 createRoot client API",
        allowed_domains: ["react.dev"],
      },
      result: {
        content: [
          {
            title: "createRoot",
            url: "https://react.dev/reference/react-dom/client/createRoot",
            excerpt:
              "createRoot lets you create a root to display React components inside a browser DOM node.",
          },
        ],
        result_count: 1,
        isError: false,
      },
      durationMs: 1350,
      status: "completed",
      approvalId: "approval_network_01",
    },
    {
      id: "call_browser_05",
      roundId: "model_03",
      name: "browser.inspect_page",
      type: "mcp",
      title: "检查本地页面（首次）",
      arguments: {
        server: "browser",
        tool: "inspect_page",
        url: "http://localhost:3102/codex",
        timeout_ms: 3000,
      },
      result: {
        isError: true,
        error: {
          code: "PAGE_TIMEOUT",
          message: "页面在 3000ms 内未达到可检查状态。",
          retryable: true,
        },
      },
      durationMs: 3000,
      status: "failed",
    },
    {
      id: "call_browser_06",
      roundId: "model_04",
      name: "browser.inspect_page",
      type: "mcp",
      title: "检查本地页面（重试）",
      arguments: {
        server: "browser",
        tool: "inspect_page",
        url: "http://localhost:3102/codex",
        timeout_ms: 10000,
        wait_until: "domcontentloaded",
      },
      result: {
        isError: false,
        title: "AGENT MATRIX · NEURAL TREE",
        heading: "Agent Runtime 运行观测站",
        url: "http://localhost:3102/codex",
        http_status: 200,
        console_errors: [],
        checks: ["输入框可见", "Runtime 拓扑已渲染", "工具与 MCP 节点可见"],
      },
      durationMs: 1200,
      status: "completed",
      retryOf: "call_browser_05",
    },
  ];
  const finalAnswer =
    "已完成只读检查：\n\n1. 项目架构：React 19 + Vite 前端，server.ts 提供 Express 服务与 WebSocket 遥测；Codex 运行记录由 Hook 网关和 app-server 适配器汇入。依据：README.md、package.json 与工作区文件列表。\n2. React 文档：已查询 react.dev 的 createRoot 参考页。package.json 声明 React ^19.0.1；这不等于核验了锁文件中的实际安装版本。\n3. 本地页面：/codex 返回 HTTP 200，输入框、Runtime 拓扑、工具与 MCP 节点可见；本次检查未发现控制台错误。\n4. 异常处理：首次页面检查超时，增大等待时间后重试成功。\n\n本轮进行了 6 次工具调用（含 1 次失败重试），经你一次性同意后查询外部文档。未修改文件、未提交代码、未部署。";
  const rounds: MockRound[] = [
    {
      id: "model_01",
      inputTokens: 1240,
      cachedInputTokens: 800,
      outputTokens: 150,
      consumedCallIds: [],
      callIds: ["call_files_01", "call_read_02"],
      response:
        "我会先读取工作区和项目说明，然后在获得联网许可后核对官方文档，再检查本地页面。整个过程保持只读。",
    },
    {
      id: "model_02",
      inputTokens: 1880,
      cachedInputTokens: 1200,
      outputTokens: 90,
      consumedCallIds: ["call_files_01", "call_read_02"],
      callIds: ["call_skill_03"],
      response: "项目依赖与目录信息已取得。检查页面前，先读取浏览器检查指南。",
    },
    {
      id: "model_03",
      inputTokens: 2310,
      cachedInputTokens: 1800,
      outputTokens: 160,
      consumedCallIds: ["call_skill_03"],
      callIds: ["call_docs_04", "call_browser_05"],
      response:
        "现在申请访问 react.dev 的只读联网查询；本地页面检查不提交任何业务表单。",
    },
    {
      id: "model_04",
      inputTokens: 2960,
      cachedInputTokens: 2300,
      outputTokens: 95,
      consumedCallIds: ["call_docs_04", "call_browser_05"],
      callIds: ["call_browser_06"],
      response:
        "第一次页面检查在 3 秒后超时。我会改用 DOM 就绪条件并重试一次，超时时间增加到 10 秒。",
    },
    {
      id: "model_05",
      inputTokens: 3540,
      cachedInputTokens: 2900,
      outputTokens: 420,
      consumedCallIds: ["call_browser_06"],
      callIds: [],
      response: finalAnswer,
    },
  ];
  const events: MockRuntimeEvent[] = [];
  type EventDraft = Omit<
    MockRuntimeEvent,
    | "id"
    | "sessionId"
    | "turnId"
    | "offsetMs"
    | "time"
    | "status"
    | "relatedNodes"
  > & { status?: MockStatus; relatedNodes?: MockNodeId[] };
  function emit(offsetMs: number, item: EventDraft) {
    const at = new Date(Date.UTC(2026, 9, 17, 2, 42, 0, offsetMs));
    events.push({
      ...item,
      id: `evt_${String(events.length + 1).padStart(3, "0")}`,
      sessionId: MOCK_SESSION_ID,
      turnId: MOCK_TURN_ID,
      offsetMs,
      time: `10:${at.toISOString().slice(14, 23)}`,
      status: item.status || "completed",
      relatedNodes: item.relatedNodes || [],
    });
  }
  emit(0, {
    name: "SessionStart",
    kind: "hook",
    node: "hook",
    source: "Hook",
    title: "会话启动",
    summary: "建立会话与回合，关联本地工作区。",
    output: {
      cwd: MOCK_CWD,
      model,
      effort: reasoningEffort,
      sandbox: "read-only",
      approval_policy: "on-request",
      subagents: "not used",
    },
  });
  emit(70, {
    name: "UserPromptSubmit",
    kind: "input",
    node: "input",
    relatedNodes: ["prompt"],
    source: "App Server",
    title: "用户提交提示词",
    summary: prompt,
    content: prompt,
    input: { text: prompt, attachments: [], source: "composer" },
  });
  emit(120, {
    name: "context.snapshot",
    kind: "context",
    node: "context",
    source: "上下文快照",
    title: "准备初始上下文",
    summary: "工作区路径、用户只读约束、会话历史与工具定义进入本轮上下文。",
    input: {
      cwd: MOCK_CWD,
      previous_turns: 0,
      selected_files: [],
      constraints: ["不要修改文件", "外部联网前确认"],
    },
    output: {
      context_budget_tokens: 32768,
      estimated_tokens: 1240,
      compaction: { triggered: false, reason: "上下文未达到压缩阈值" },
      project_rules_file: {
        path: "AGENTS.md",
        status: "not present",
        content: null,
      },
    },
  });
  const memories: MockMemory[] = [
    { id: "answer-style", title: "回答偏好", scope: "用户", mode: "始终带入", content: "先给摘要，再提供证据与细节。", source: "memory://demo/user/answer-style", updatedAt: "2026-10-16 09:30" },
    { id: "project-map", title: "项目架构备忘", scope: "项目", mode: "按需读取", content: "React/Vite 展示运行链路，Express 与 WebSocket 汇入观测事件。读取当前文件后再核对，备忘不能替代最新证据。", source: "memory://demo/project/architecture", updatedAt: "2026-10-17 10:20" },
    { id: "release-notes", title: "历史发布约定", scope: "项目", mode: "按需读取", content: "发布前记录版本变更。本轮无发布任务，因此不读取。", source: "memory://demo/project/releases", updatedAt: "2026-10-15 16:00" },
  ];
  emit(160, {
    name: "memory.snapshot", kind: "context", node: "context", source: "上下文快照",
    title: "发现演示记忆库", summary: "3 条虚构记忆；回答偏好带入上下文，其余按需读取。本轮不写入记忆。",
    output: { entries: memories, loaded_ids: ["answer-style"], storage: "fictional; no workspace files read or written" },
  });
  emit(4000, {
    name: "memory.loaded", kind: "context", node: "context", source: "上下文快照",
    title: "按需读取项目架构备忘", summary: "架构备忘将在下一次模型请求中带入，并与最新文件核对。",
    output: { memory_id: "project-map", content: memories[1].content, action: "read", persisted_writes: 0 },
  });
  emit(200, {
    name: "prompt.composition",
    kind: "prompt",
    node: "prompt",
    source: "上下文快照",
    title: "可见提示词组成",
    summary:
      "演示指令、用户消息、上下文及工具定义。完整内部系统提示词不可观测。",
    input: {
      demonstration_instruction: instruction,
      user_message: prompt,
      context_refs: ["workspace", "history", "tool_definitions"],
    },
    output: {
      full_internal_system_prompt: "unavailable",
      hidden_reasoning: "unavailable",
      schema: "product mock; not a Codex protocol event",
    },
    content: instruction,
  });
  emit(260, {
    name: "capabilities.snapshot",
    kind: "mcp",
    node: "mcp",
    relatedNodes: ["prompt"],
    source: "上下文快照",
    title: "发现可用工具与 MCP 服务",
    summary:
      "1 个本地命令工具、2 个演示 MCP 服务；未调用的能力与实际调用分开。",
    output: {
      tools: [
        {
          name: "exec_command",
          input_schema: { cmd: "string", cwd: "string" },
        },
      ],
      servers: [
        {
          name: "documentation",
          status: "ready",
          tools: [
            {
              name: "search",
              input_schema: { query: "string", allowed_domains: "string[]" },
            },
          ],
        },
        {
          name: "browser",
          status: "ready",
          tools: [
            {
              name: "inspect_page",
              input_schema: {
                url: "string",
                timeout_ms: "number",
                wait_until: "string?",
              },
            },
          ],
        },
      ],
      note: "服务和工具名为本原型的模拟配置",
      skills: MOCK_SKILL_CATALOG,
    },
  });

  function requestRound(index: number, at: number) {
    const round = rounds[index];
    const memoryTokens = index >= 2 ? 300 : 180;
    const skillTokens = index >= 2 ? 200 : 0;
    const contextSnapshot: MockContextSnapshot = {
      total: round.inputTokens, limit: 32768, basis: "mock-estimate",
      segments: [
        { id: "instructions", label: "指令与约束", tokens: 240 },
        { id: "user", label: "用户消息", tokens: 120 },
        { id: "definitions", label: "工具 / MCP 定义", tokens: 500 },
        { id: "memory", label: "已读取记忆", tokens: memoryTokens },
        { id: "skill", label: "已加载 Skill", tokens: skillTokens },
        { id: "history", label: "历史消息与工具结果", tokens: round.inputTokens - 860 - memoryTokens - skillTokens },
      ],
      memoryIds: index >= 2 ? ["answer-style", "project-map"] : ["answer-style"],
    };
    emit(at, {
      name: "model.request",
      kind: "model",
      node: "model",
      relatedNodes: ["prompt"],
      source: "App Server",
      roundId: round.id,
      title: `第 ${index + 1} 次模型请求`,
      summary: round.consumedCallIds.length
        ? `追加 ${round.consumedCallIds.length} 个工具结果，继续模型循环。`
        : "发送初始消息与可用工具定义。",
      input: {
        model,
        effort: reasoningEffort,
        demonstration_instruction: instruction,
        user_message: prompt,
        context_refs: ["context.snapshot", "capabilities.snapshot"],
        active_skill_refs: index >= 2 ? ["browser-inspection"] : [],
        context_snapshot: contextSnapshot,
        added_tool_results: round.consumedCallIds.map((id) => ({
          call_id: id,
          result: calls.find((call) => call.id === id)!.result,
        })),
        tool_choice: "auto",
        previous_context_retained: true,
      },
      output: {
        response_mode: round.callIds.length ? "tool_calls" : "final_answer",
      },
    });
    round.callIds.forEach((id, callIndex) => {
      const call = calls.find((item) => item.id === id)!;
      emit(at + 300 + callIndex * 20, {
        name: "model.tool_call",
        kind: "model",
        node: "model",
        relatedNodes: [call.type === "mcp" ? "mcp" : "tool"],
        source: "App Server",
        callId: call.id,
        roundId: round.id,
        title: `请求工具 · ${call.name}`,
        summary: call.title,
        input: call.arguments,
        output: { call_id: call.id, retry_of: call.retryOf || null },
      });
    });
    if (index !== 4)
      emit(at + 180, {
        name: "assistant.message",
        kind: "model",
        node: "model",
        relatedNodes: ["output"],
        source: "App Server",
        roundId: round.id,
        title: "Agent 可见进度消息",
        summary: round.response,
        content: round.response,
      });
  }
  function finishRound(index: number, at: number) {
    const round = rounds[index];
    emit(at, {
      name: "model.response.completed",
      kind: "model",
      node: "model",
      source: "App Server",
      roundId: round.id,
      title: `第 ${index + 1} 次模型响应结束`,
      summary: `输入 ${round.inputTokens} token / 输出 ${round.outputTokens} token；${round.callIds.length} 个工具调用。`,
      output: {
        input_tokens: round.inputTokens,
        cached_input_tokens: round.cachedInputTokens,
        output_tokens: round.outputTokens,
        call_ids: round.callIds,
        internal_reasoning: "not exposed",
      },
    });
  }
  function runCall(index: number, at: number, approval = false) {
    const call = calls[index];
    const node = call.type === "mcp" ? "mcp" : "tool";
    const common = { callId: call.id, roundId: call.roundId };
    emit(at + 50, {
      ...common,
      name: "PreToolUse",
      kind: "hook",
      node: "hook",
      relatedNodes: [node],
      source: "Hook",
      title: `执行前 Hook · ${call.name}`,
      summary: `检查 ${call.id} 的输入，关联后续策略与执行记录。`,
      input: { tool_name: call.name, arguments: call.arguments },
      output: {
        action: "continue",
        handler: "local-runtime-telemetry",
        note: "Hook 触发顺序为本原型模拟配置",
      },
    });
    let startedAt = at + 150;
    if (approval) {
      emit(at + 80, {
        ...common,
        name: "PermissionRequest",
        kind: "gate",
        node: "gate",
        relatedNodes: ["hook"],
        source: "Hook",
        status: "waiting",
        title: "等待联网授权",
        summary: "访问 react.dev，命中“联网前先确认”的用户约束。",
        input: {
          approval_id: call.approvalId,
          reason: "用户要求联网前确认",
          host: "react.dev",
          scope: "single-call",
          mode: "read-only",
        },
        output: { decision: "pending", tool_executed: false },
      });
      emit(at + 2880, {
        ...common,
        name: "approval.decision",
        kind: "gate",
        node: "gate",
        source: "演示用户",
        status: "allowed",
        title: "演示用户同意本次联网",
        summary: "仅授权这一次 react.dev 只读查询；此决策为 mock 记录。",
        input: {
          approval_id: call.approvalId,
          decision: "allow_once",
          actor: "mock-user",
        },
        output: {
          wait_duration_ms: 2800,
          scope: "single-call",
          real_permission_granted: false,
        },
      });
      startedAt = at + 3000;
    }
    emit(startedAt - 40, {
      ...common,
      name: "policy.decision",
      kind: "gate",
      node: "gate",
      source: "策略快照",
      status: "allowed",
      title: `策略允许 · ${call.title}`,
      summary: approval
        ? "一次性联网授权已满足，允许继续。"
        : "本地只读操作在演示策略允许范围内。",
      input: {
        tool_name: call.name,
        sandbox: "read-only",
        approval_policy: "on-request",
      },
      output: {
        decision: "allow",
        reason: approval
          ? "explicit_mock_approval"
          : "read_only_workspace_or_localhost",
      },
    });
    emit(startedAt, {
      ...common,
      name: "tool.started",
      kind: call.type === "mcp" ? "mcp" : "tool",
      node,
      source: "App Server",
      status: "running",
      title: call.title,
      summary: `${call.name} 开始执行。`,
      input: call.arguments,
    });
    const endedAt = startedAt + call.durationMs;
    emit(endedAt, {
      ...common,
      name: call.status === "failed" ? "tool.failed" : "tool.completed",
      kind: call.type === "mcp" ? "mcp" : "tool",
      node,
      relatedNodes:
        index === 0 || index === 3 ? ["search"] : index === 2 ? ["skill"] : [],
      source: "App Server",
      status: call.status,
      title: `${call.title} · ${call.status === "failed" ? "失败" : "完成"}`,
      summary:
        call.status === "failed"
          ? "PAGE_TIMEOUT：达到 3000ms 超时，将错误返回模型。"
          : `${call.durationMs}ms 完成，可查看具体参数与返回内容。`,
      durationMs: call.durationMs,
      input: call.arguments,
      output: call.result,
    });
    emit(endedAt + 10, {
      ...common,
      name: call.status === "failed" ? "PostToolUseFailure" : "PostToolUse",
      kind: "hook",
      node: "hook",
      relatedNodes: [node],
      source: "Hook",
      status: call.status,
      title: `${call.status === "failed" ? "失败" : "执行后"} Hook · ${call.name}`,
      summary: `与 PreToolUse 使用相同 call ID：${call.id}。`,
      output: {
        tool_name: call.name,
        status: call.status,
        duration_ms: call.durationMs,
        paired_pre_hook: true,
      },
    });
    emit(endedAt + 40, {
      ...common,
      name: "context.tool_result",
      kind: "context",
      node: "context",
      relatedNodes: ["model"],
      source: "上下文快照",
      title: "工具结果写回消息上下文",
      summary: `${call.id} 的${call.status === "failed" ? "错误" : "结果"}将供下一次模型请求使用。`,
      input: { call_id: call.id },
      output: {
        message_role: "tool",
        result: call.result,
        next_model_request: rounds[Number(call.roundId.slice(-2))]?.id || null,
      },
    });
    return endedAt;
  }
  requestRound(0, 350);
  runCall(0, 1000);
  runCall(1, 1900);
  finishRound(0, 900);
  requestRound(1, 2800);
  const skillEnd = runCall(2, 3300);
  emit(skillEnd + 60, {
    name: "skill.reference.loaded",
    kind: "skill",
    node: "skill",
    relatedNodes: ["context", "prompt"],
    source: "上下文快照",
    callId: "call_skill_03",
    roundId: "model_02",
    title: "browser-inspection Skill 已读取",
    summary: "加载实际演示指南内容：本地只读检查、错误记录、允许一次重试。",
    input: {
      name: "browser-inspection",
      path: ".codex/skills/browser-inspection/SKILL.md",
      trigger: "用户要求检查本地页面",
      source_is_mock: true,
    },
    output: {
      content: skillText,
      effect: "追加工作方法，后续使用 browser.inspect_page",
    },
    content: skillText,
  });
  finishRound(1, 3200);
  requestRound(2, 4100);
  runCall(3, 4500, true);
  runCall(4, 9200);
  finishRound(2, 4480);
  requestRound(3, 12700);
  runCall(5, 13200);
  finishRound(3, 13100);
  requestRound(4, 15000);
  emit(15800, {
    name: "assistant.message.delta",
    kind: "result",
    node: "output",
    source: "App Server",
    roundId: "model_05",
    title: "最终回答开始流式返回",
    summary: "先返回检查摘要，再补充证据与异常处理。",
    output: { sequence: 1, delta: "已完成只读检查：", done: false },
  });
  emit(16800, {
    name: "assistant.message.completed",
    kind: "result",
    node: "output",
    source: "App Server",
    roundId: "model_05",
    title: "最终回答全文",
    summary: "项目架构、React 文档引用、本地页面结果与超时重试说明。",
    output: {
      text: finalAnswer,
      citations: [
        "README.md",
        "package.json",
        "https://react.dev/reference/react-dom/client/createRoot",
      ],
      files_modified: [],
      commit_created: false,
      deployment_run: false,
    },
    content: finalAnswer,
  });
  finishRound(4, 16900);
  emit(17000, {
    name: "Stop",
    kind: "hook",
    node: "hook",
    source: "Hook",
    title: "回合结束 Hook",
    summary: "记录最终响应已完成，本轮没有子 Agent、压缩或文件变更。",
    output: {
      reason: "completed",
      subagents_started: 0,
      compaction_triggered: false,
      files_modified: 0,
    },
  });
  emit(17100, {
    name: "turn.completed",
    kind: "result",
    node: "output",
    source: "App Server",
    title: "回合完成，等待下一条用户输入",
    summary: "5 次模型请求、6 次工具调用、1 次审批、1 次失败后重试成功。",
    output: { status: "completed", session_continues: true, mock: true },
  });
  events.sort((a, b) => a.offsetMs - b.offsetMs);
  events.forEach((event, index) => {
    event.id = `evt_${String(index + 1).padStart(3, "0")}`;
  });
  const usage = rounds.reduce(
    (sum, round) => ({
      inputTokens: sum.inputTokens + round.inputTokens,
      outputTokens: sum.outputTokens + round.outputTokens,
      cachedInputTokens: sum.cachedInputTokens + round.cachedInputTokens,
    }),
    { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
  );
  return {
    id: MOCK_SESSION_ID,
    turnId: MOCK_TURN_ID,
    cwd: MOCK_CWD,
    prompt,
    model,
    reasoningEffort,
    instruction,
    skillText,
    skillCatalog: MOCK_SKILL_CATALOG,
    finalAnswer,
    calls,
    rounds,
    events,
    usage,
    durationMs: 17100,
    schemaVersion: "agent-matrix.mock.v1",
    isMock: true as const,
  };
}
type RuntimeRound = Omit<MockRound, "inputTokens" | "cachedInputTokens" | "outputTokens"> & {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
};
type RuntimeCall = Omit<MockCall, "durationMs"> & { durationMs: number | null; status: Exclude<MockStatus, "allowed"> };
export type MockRuntimeSession = Omit<ReturnType<typeof createCodexRuntimeMock>, "isMock" | "isReal" | "usage" | "rounds" | "calls" | "durationMs" | "skillCatalog"> & {
  isMock: boolean;
  isReal?: boolean;
  dataSource?: "mock" | "live";
  usage: { inputTokens: number | null; outputTokens: number | null; cachedInputTokens: number | null };
  rounds: RuntimeRound[];
  calls: RuntimeCall[];
  durationMs: number | null;
  skillCatalog: readonly { id: string; title: string; description: string; icon: string }[];
  rolloutTelemetry?: CodexRolloutTelemetry | null;
};
export function mockEventsForNode(
  session: MockRuntimeSession,
  node: MockNodeId,
) {
  return session.events.filter(
    (event) => event.node === node || event.relatedNodes.includes(node),
  );
}

export function mockEventsForCall(session: MockRuntimeSession, callId: string) {
  return session.events.filter(
    (event) =>
      event.callId === callId ||
      (event.name === "model.request" &&
        Array.isArray(event.input?.added_tool_results) &&
        event.input.added_tool_results.some(
          (result: { call_id: string }) => result.call_id === callId,
        )),
  );
}
