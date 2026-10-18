import type { MockNodeId } from "../codexRuntimeMock";

export interface RuntimeNode {
  id: MockNodeId;
  title: string;
  code: string;
  color: string;
  position: [number, number, number];
  note: string;
  summary: string;
  glyph: string[];
}
export const RUNTIME_NODES: RuntimeNode[] = [
  {
    id: "input",
    title: "用户输入",
    code: "USER INPUT",
    color: "#8dcfff",
    position: [-10, 0.2, 4],
    note: "1 条用户消息",
    summary: "原始提示词进入回合，携带只读与联网前确认的约束。",
    glyph: [
      "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z",
      "M8 9h8M8 13h5",
    ],
  },
  {
    id: "context",
    title: "上下文",
    code: "CONTEXT",
    color: "#89ddf0",
    position: [-10, 1.7, -3],
    note: "工作区 + 工具结果",
    summary: "目录、项目说明、Skill 和执行结果逐轮写入模型上下文。",
    glyph: ["m12 3 10 5-10 5L2 8Z", "m2 12 10 5 10-5M2 16l10 5 10-5"],
  },
  {
    id: "prompt",
    title: "提示词",
    code: "MESSAGES",
    color: "#a0baff",
    position: [-5.5, 1.7, -8],
    note: "指令 + 消息 + 定义",
    summary: "演示指令、用户输入与可用工具定义构成模型请求。",
    glyph: [
      "M8 3h7l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
      "M14 3v6h6M8 13h8M8 17h5",
    ],
  },
  {
    id: "skill",
    title: "Skill 指南",
    code: "SKILL",
    color: "#c4acff",
    position: [1, 1.7, -9],
    note: "browser-inspection",
    summary: "通过命令读取演示 SKILL.md，约束页面检查及一次超时重试。",
    glyph: [
      "M12 7c-3-3-7-3-10-2v15c3-1 7-1 10 2 3-3 7-3 10-2V5c-3-1-7-1-10 2ZM12 7v15",
    ],
  },
  {
    id: "model",
    title: "Codex 模型",
    code: "MODEL CORE",
    color: "#b6b3ff",
    position: [0, 3.4, 0],
    note: "5 轮请求 · 6 次调用",
    summary:
      "接收上下文，生成工具调用；消费工具返回值后继续响应，最终结束回合。",
    glyph: ["m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z", "M21 2v5M18.5 4.5h5"],
  },
  {
    id: "hook",
    title: "Hook 观测",
    code: "LIFECYCLE",
    color: "#9fdcc5",
    position: [7, 2.2, -7],
    note: "执行前 / 后 / 失败",
    summary: "围绕工具执行触发的生命周期记录，通过 call ID 前后配对。",
    glyph: ["M9 3h6v6H9ZM2 16h6v6H2ZM16 16h6v6h-6Z", "M12 9v4M5 16v-3h14v3"],
  },
  {
    id: "gate",
    title: "权限门禁",
    code: "APPROVAL",
    color: "#edcf92",
    position: [11, 2.2, -1],
    note: "1 次联网确认",
    summary: "react.dev 查询先等待演示用户的一次性许可，然后才开始执行。",
    glyph: [
      "M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6c3 0 5.5-1.5 8-4 2.5 2.5 5 4 8 4Z",
      "m8.5 12 2.5 2.5 4.5-5",
    ],
  },
  {
    id: "tool",
    title: "本地工具",
    code: "EXEC COMMAND",
    color: "#8bd5e8",
    position: [9, 0.3, 6],
    note: "3 次只读命令",
    summary: "列出目录、读取说明与依赖、加载 Skill；参数和 stdout 全部可查。",
    glyph: [
      "M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z",
      "m7 9 3 3-3 3M13 15h4",
    ],
  },
  {
    id: "mcp",
    title: "MCP 服务",
    code: "CONNECTORS",
    color: "#83c5ff",
    position: [3.5, 0.3, 10],
    note: "2 服务 · 3 次调用",
    summary: "documentation 查询官方文档，browser 首次检查超时，第二次成功。",
    glyph: ["M8 3v5M16 3v5M5 8h14v4a7 7 0 0 1-14 0ZM12 19v3", "M8 11h8"],
  },
  {
    id: "search",
    title: "搜索与资料",
    code: "RETRIEVAL",
    color: "#9ed4d8",
    position: [-3, 1.7, 10],
    note: "rg / react.dev",
    summary: "本地文件枚举与外部文档检索两种用途，对应不同的执行工具。",
    glyph: ["M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l6 6"],
  },
  {
    id: "output",
    title: "返回用户",
    code: "RESPONSE",
    color: "#9eebbd",
    position: [-8, 0.2, 9],
    note: "最终回答 + 引用",
    summary: "汇总架构、文档、页面检查结果，以及超时重试与证据来源。",
    glyph: [
      "M9 11l3 3L22 4",
      "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    ],
  },
];
export interface RuntimeEdge {
  from: MockNodeId;
  to: MockNodeId;
  type: "message" | "call" | "feedback" | "reference";
}
export const RUNTIME_EDGES: RuntimeEdge[] = [
  { from: "input", to: "context", type: "message" },
  { from: "context", to: "prompt", type: "message" },
  { from: "prompt", to: "model", type: "message" },
  { from: "skill", to: "model", type: "reference" },
  { from: "model", to: "hook", type: "call" },
  { from: "hook", to: "gate", type: "call" },
  { from: "gate", to: "tool", type: "call" },
  { from: "gate", to: "mcp", type: "call" },
  { from: "model", to: "tool", type: "call" },
  { from: "model", to: "mcp", type: "call" },
  { from: "tool", to: "model", type: "feedback" },
  { from: "mcp", to: "model", type: "feedback" },
  { from: "search", to: "model", type: "feedback" },
  { from: "mcp", to: "search", type: "reference" },
  { from: "tool", to: "search", type: "reference" },
  { from: "model", to: "output", type: "message" },
];
