export type MatrixMode = 'claude' | 'codex' | 'hybrid';

export type TelemetryMode = 'gateway' | 'simulation';
export type WsConnectionState = 'connected' | 'probing' | 'offline' | 'simulation';

export type AgentRole = 
  | 'advisor' 
  | 'main_session' 
  | 'jev_router' 
  | 'subagent_worker' 
  | 'subagent_explorer' 
  | 'subagent_researcher';

export interface ToolCall {
  name: string;
  args: string;
  status: 'pending' | 'executing' | 'completed' | 'blocked';
  output?: string;
  durationMs?: number;
}

export interface DiffSnippet {
  filePath: string;
  oldCode: string;
  newCode: string;
  diffLines?: { type: 'add' | 'del' | 'same'; text: string; lineNo?: number }[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  agentTag: string;
  agentColor: string; // 'purple' | 'amber' | 'cyan' | 'emerald' | 'rose'
  category: 'tool' | 'ast' | 'router' | 'alert' | 'diff' | 'system' | 'hitl';
  message: string;
  diffSnippet?: DiffSnippet;
  probabilities?: {
    pInline: number;
    pSubagents: number;
    pEscalate: number;
  };
  toolCall?: ToolCall;
  riskLevel?: 'nominal' | 'elevated' | 'critical';
}

export interface JevMetrics {
  pInline: number;
  pSubagents: number;
  pEscalate: number;
  entropy: number;
  confidence: number;
  monteCarloSamples: number;
  decisionRule: string;
}

export interface SubagentTask {
  id: string;
  name: string;
  model: string;
  type: 'worker' | 'explorer' | 'researcher';
  badge: string; // e.g., '[AST]', '[docs]', '[112/112]'
  status: 'idle' | 'running' | 'streaming' | 'complete' | 'blocked';
  progress: number;
  currentPayload: string;
  itemsProcessed: number;
  totalItems: number;
  frequencyHz: number;
  sparkline: number[];
}

export interface HitlApprovalRequest {
  id: string;
  timestamp: string;
  triggerType: 'sensitive_file' | 'high_risk_score' | 'manual_test' | 'gateway_hook';
  targetPath: string;
  riskScore: number;
  cveOrRule: string;
  summary: string;
  detailedAudit: string[];
  diffSnippet: DiffSnippet;
  injectedPrompt?: string;
}

export interface FinOpsMetrics {
  burnRatePerMin: number; // e.g. 0.18 $/min
  burnTrend: number[]; // mini sparkline
  tokensUsed: number;
  maxTokens: number;
  watermarkPct: number;
  cyclomaticComplexityDelta: number; // e.g. +2
  loopCircuitBreakerCount: number; // e.g. 0 / 3
  totalSessionCost: number; // e.g. $0.42
}

export interface RealSystemStatus {
  isReal: boolean;
  cwd: string;
  hostname: string;
  platform?: string;
  gitBranch: string;
  gitStatus: string;
  gitDiff?: string;
  modifiedFiles: string[];
  gitRecentCommit: string;
  nodeVersion: string;
  memoryUsageMB: number;
  uptimeSec?: number;
  activeClientsCount: number;
  totalRealEvents: number;
  hasClaudeHooks?: boolean;
  timestamp: string;
}

export interface SessionWorkspace {
  id: string;
  tag: string;
  title: string;
  branch: string;
  activeFile: string;
  step: number;
  totalSteps: number;
  directive: string;
  activeDiff: DiffSnippet;
  finOps: FinOpsMetrics;
  jev: JevMetrics;
  subagents: SubagentTask[];
  isBlocked: boolean;
  pendingHitl?: HitlApprovalRequest;
  isRealWorkspace?: boolean;
  realCwd?: string;
  realCommit?: string;
  realModifiedFiles?: string[];
}

export interface AdvisorState {
  model: string;
  status: 'standby' | 'evaluating' | 'alert' | 'blocked';
  riskScore: number;
  riskCeiling: number;
  alertActive: boolean;
  alertReason: string;
  alertTimestamp?: string;
  pendingHitl?: HitlApprovalRequest;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'watching';
    detail: string;
  }[];
}
