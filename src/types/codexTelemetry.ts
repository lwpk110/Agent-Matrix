export interface CodexRolloutTelemetry {
  sessionId: string;
  turnId: string;
  model: string | null;
  reasoningEffort: string | null;
  modelRequestCount: number | null;
  requests: Array<{
    inputTokens: number | null;
    cachedInputTokens: number | null;
    outputTokens: number | null;
    reasoningTokens: number | null;
  }>;
  turnUsage: {
    inputTokens: number | null;
    cachedInputTokens: number | null;
    outputTokens: number | null;
    reasoningTokens: number | null;
    totalTokens: number | null;
  } | null;
  latestRequest: {
    inputTokens: number | null;
    cachedInputTokens: number | null;
    outputTokens: number | null;
    reasoningTokens: number | null;
  } | null;
  contextWindowTokens: number | null;
}
