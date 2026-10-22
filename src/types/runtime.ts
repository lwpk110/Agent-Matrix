/** 正式观测模型。它描述已脱敏的展示数据，不依赖任何演示会话工厂。 */
export type RuntimeProviderId = string;
export type RuntimeNodeId = "input" | "context" | "prompt" | "skill" | "model" | "hook" | "gate" | "tool" | "mcp" | "search" | "output";
export type RuntimeKind = Exclude<RuntimeNodeId, "output"> | "result";
export type RuntimeStatus = "completed" | "running" | "waiting" | "failed" | "allowed" | "unknown";

export interface RuntimeEvent {
  id: string;
  provider?: RuntimeProviderId;
  sessionId: string;
  turnId: string;
  offsetMs: number;
  time: string;
  name: string;
  kind: RuntimeKind;
  node: RuntimeNodeId;
  relatedNodes: RuntimeNodeId[];
  source: string;
  title: string;
  summary: string;
  status: RuntimeStatus;
  isReal?: boolean;
  flow?: { from: RuntimeNodeId; to: RuntimeNodeId };
  callId?: string;
  toolName?: string;
  roundId?: string;
  durationMs?: number;
  /** Hook 前后事件的采样间隔，不代表工具实际执行时长。 */
  observedIntervalMs?: number;
  hasToolResponse?: boolean;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  content?: string;
}

export interface RuntimeRequestUsage {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
}

/** 各运行时可选提供的已脱敏回合遥测。缺失字段必须保持未采集。 */
export interface RuntimeTelemetry {
  sessionId?: string | null;
  turnId?: string | null;
  model?: string | null;
  modelSource?: 'request-statistics' | 'hook-declared' | null;
  reasoningEffort?: string | null;
  modelRequestCount?: number | null;
  requests?: RuntimeRequestUsage[];
  durationMs?: number | null;
  contextWindowTokens?: number | null;
  latestRequest?: { inputTokens?: number | null } | null;
  contextMetadata?: { instructionFileCount: number | null; observedAt: string | null; source: 'claude-transcript'; scope: 'turn' | 'session' } | null;
  promptMetadata?: { systemSegmentCount: number | null; toolDefinitionCount: number | null; observedAt: string | null; source: 'claude-transcript'; scope: 'turn' | 'session' } | null;
  toolCallMetadata?: Array<{ callId: string; name: string; resultObserved: boolean; isError: boolean | null; observedAt: string | null }>;
  memoryMetadata?: { status: 'present' | 'missing' | 'unavailable'; fileCount: number; totalBytes: number; latestModifiedAt: string | null; globalFileCount?: number; projectFileCount?: number; globalBytes?: number; projectBytes?: number } | null;
  turnUsage?: {
    inputTokens?: number | null;
    nativeInputTokens?: number | null;
    cacheCreationInputTokens?: number | null;
    cacheReadInputTokens?: number | null;
    outputTokens?: number | null;
    cachedInputTokens?: number | null;
    reasoningTokens?: number | null;
    totalTokens?: number | null;
  } | null;
}
export interface RuntimeSkillSource {
  scope: "project" | "global" | "runtime";
  root: string;
  path: string;
  modifiedAt: string;
  sizeBytes: number;
  metadata: Record<string, string>;
  rawMetadata: string;
  content: string;
}

export interface RuntimeCall {
  id: string; roundId: string; name: string; type: "local" | "mcp"; title: string;
  arguments: Record<string, unknown>; result: Record<string, unknown>; durationMs: number | null;
  status: RuntimeStatus; resultReceived?: boolean; retryOf?: string; approvalId?: string; source?: 'runtime-event' | 'claude-transcript'; metadataOnly?: boolean; resultError?: boolean | null; observedAt?: string | null;
}
export interface RuntimeRound { id: string; inputTokens: number | null; cachedInputTokens: number | null; outputTokens: number | null; consumedCallIds: string[]; callIds: string[]; response: string; }
export interface RuntimeSession {
  id: string; provider?: RuntimeProviderId; turnId: string; cwd: string; prompt: string; model: string;
  reasoningEffort: string; instruction: string; skillText: string; skillCatalog: readonly { id: string; title: string; description: string; icon: string }[]; rolloutTelemetry?: RuntimeTelemetry | null;
  finalAnswer: string; calls: RuntimeCall[]; rounds: RuntimeRound[];
  events: RuntimeEvent[]; usage: { inputTokens: number | null; outputTokens: number | null; cachedInputTokens: number | null };
  durationMs: number | null; schemaVersion: string; isMock: boolean; isReal?: boolean; dataSource?: "live" | "mock";
  capabilities?: { rolloutTelemetry?: boolean; skills?: boolean; promptTelemetry?: boolean };
}
