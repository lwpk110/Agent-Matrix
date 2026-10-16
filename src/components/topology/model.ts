import type { BlackBoxStage } from '../../types/matrix';

export type Layout = 'layered' | 'orbit';
export type NodeId = 'prompt' | 'core' | 'hook' | 'gate' | 'shell' | 'files' | 'feedback';
export type NodeState = 'active' | 'blocked' | 'waiting' | 'ready';
export interface TopologyNode {
  id: NodeId;
  stage: BlackBoxStage;
  label: [string, string];
  description: [string, string];
  category: [string, string];
  color: string;
  code: string;
  layer: number;
  positions: Record<Layout, [number, number, number]>;
}

// Architecture contracts, not discovered infrastructure or measured telemetry.
export const NODES: readonly TopologyNode[] = [
  { id: 'prompt', stage: 'prompt', label: ['任务上下文', 'Task context'], description: ['组装用户需求、工作区规则与上下文，形成推理输入。', 'Assembles user intent, workspace rules and context for reasoning.'], category: ['输入层', 'INPUT'], color: '#b29aff', code: 'CTX', layer: 0, positions: { layered: [-7, 0, -4], orbit: [0, 0, -7] } },
  { id: 'core', stage: 'llm', label: ['推理引擎', 'Reasoning engine'], description: ['理解上下文并生成工具调用；接收执行结果，继续推理循环。', 'Interprets context, proposes tool calls and reasons over returned observations.'], category: ['编排层', 'ORCHESTRATION'], color: '#64dcf0', code: 'LLM', layer: 1, positions: { layered: [-2.6, 1.4, -1.6], orbit: [0, 1.4, 0] } },
  { id: 'hook', stage: 'mcp_hook', label: ['工具调用钩子', 'Tool hooks'], description: ['接入 PreToolUse / PostToolUse 事件，将调用交给权限流程。', 'Receives PreToolUse / PostToolUse events and forwards calls to permission handling.'], category: ['编排层', 'ORCHESTRATION'], color: '#64dcf0', code: 'MCP', layer: 1, positions: { layered: [2, 1.4, -1.6], orbit: [6, 0, -3.8] } },
  { id: 'gate', stage: 'permission', label: ['权限闸门', 'Permission gate'], description: ['评估调用权限；需要人工审批时阻断后续执行。', 'Evaluates permissions and holds downstream execution for human approval.'], category: ['策略层', 'POLICY'], color: '#f6bd70', code: 'HITL', layer: 2, positions: { layered: [6.8, 1.4, -1.6], orbit: [6, 0, 3.8] } },
  { id: 'shell', stage: 'sandbox', label: ['终端执行', 'Shell execution'], description: ['运行命令并返回退出码与标准输出。隔离能力取决于实际运行环境。', 'Runs commands and returns exit codes and output. Isolation depends on the runtime.'], category: ['执行层', 'EXECUTION'], color: '#6ae0b5', code: 'PTY', layer: 3, positions: { layered: [4, 0, 4.6], orbit: [2.5, 0, 7] } },
  { id: 'files', stage: 'sandbox', label: ['工作区文件', 'Workspace files'], description: ['读写工作区文件并追踪变更；回滚能力由实际工具提供。', 'Reads and writes workspace files. Change tracking and rollback depend on the tools.'], category: ['执行层', 'EXECUTION'], color: '#7aaaff', code: 'FS', layer: 3, positions: { layered: [-0.6, 0, 4.6], orbit: [-4.5, 0, 5.6] } },
  { id: 'feedback', stage: 'feedback', label: ['结果回传', 'Observation loop'], description: ['将工具输出与错误反馈给推理引擎，完成一次执行闭环。', 'Returns tool output and errors to the reasoning engine to close the execution loop.'], category: ['反馈层', 'FEEDBACK'], color: '#d49cde', code: 'OBS', layer: 4, positions: { layered: [-6, 0, 3.3], orbit: [-6.8, 0, -1.5] } },
];
export interface TopologyEdge { id: string; from: NodeId; to: NodeId; label: [string, string]; downstream?: boolean }
export const EDGES: readonly TopologyEdge[] = [
  { id: 'context', from: 'prompt', to: 'core', label: ['上下文装配', 'Context assembly'] },
  { id: 'tool-call', from: 'core', to: 'hook', label: ['工具调用', 'Tool call'] },
  { id: 'policy', from: 'hook', to: 'gate', label: ['权限检查', 'Permission check'] },
  { id: 'dispatch-shell', from: 'gate', to: 'shell', label: ['命令分发', 'Shell dispatch'], downstream: true },
  { id: 'dispatch-files', from: 'gate', to: 'files', label: ['文件访问', 'File access'], downstream: true },
  { id: 'shell-output', from: 'shell', to: 'feedback', label: ['标准输出', 'Process output'], downstream: true },
  { id: 'file-output', from: 'files', to: 'feedback', label: ['变更结果', 'File result'], downstream: true },
  { id: 'loopback', from: 'feedback', to: 'core', label: ['观察反馈', 'Observation'], downstream: true },
];
export function nodeState(node: TopologyNode, activeStage: BlackBoxStage | undefined, blocked: boolean): NodeState {
  if (blocked && node.id === 'gate') return 'blocked';
  if (blocked && node.layer >= 3) return 'waiting';
  return node.stage === activeStage ? 'active' : 'ready';
}
export function relatedNodes(id: NodeId): Set<NodeId> {
  return new Set([id, ...EDGES.filter(e => e.from === id || e.to === id).flatMap(e => [e.from, e.to])]);
}
export function matchesNode(node: TopologyNode, query: string): boolean {
  const text = query.trim().toLocaleLowerCase();
  return !text || [node.id, node.code, node.stage, ...node.label, ...node.category].some(value => value.toLocaleLowerCase().includes(text));
}
