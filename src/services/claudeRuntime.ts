import { randomUUID } from 'node:crypto';

export interface ClaudeRuntimeEvent {
  provider: 'claude';
  source: 'claude-hook';
  eventId: string;
  hookEventName: string;
  sessionId?: string;
  toolUseId?: string;
  turnId?: string;
  toolName?: string;
  cwd?: string;
  model?: string;
  reasoningEffort?: string;
  permissionMode?: string;
  agentId?: string;
  agentType?: string;
  phase: 'prompt' | 'started' | 'completed' | 'permission' | 'lifecycle';
  hasToolResponse: boolean;
  permissionDecision?: string;
  correlationStatus?: 'pending' | 'paired' | 'unpaired';
  pairedEventId?: string;
  observedIntervalMs?: number;
  timestamp: string;
  payload: Record<string, unknown>;
}

const SECRET = /\b(?:sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._~+/-]+=*)\b|\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret)\s*[:=]\s*[^\s"']+/gi;
const SENSITIVE = /(?:api.?key|access.?token|refresh.?token|id.?token|token|password|secret|authorization|cookie|credential|private.?key)/i;
function effort(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 80);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const candidate = (value as Record<string, unknown>).level ?? (value as Record<string, unknown>).value;
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim().slice(0, 80) : undefined;
  }
  return undefined;
}

function safe(value: unknown, depth = 0): unknown {
  if (depth >= 5) return '[TRUNCATED]';
  if (typeof value === 'string') return value.replace(SECRET, (match, label?: string) => label ? `${label}=[REDACTED]` : '[REDACTED]').slice(0, 4000);
  if (Array.isArray(value)) return value.slice(0, 30).map(item => safe(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !/(?:transcript|rollout)_path|(?:^|_)path$|(?:private_)?reasoning|hook_prompt|^(?:tool_response|response|result|output|stdout|stderr)$/i.test(key))
    .slice(0, 60).map(([key, item]) => [key, SENSITIVE.test(key) ? '[REDACTED]' : safe(item, depth + 1)]));
}

export function normalizeClaudeHookPayload(input: unknown): ClaudeRuntimeEvent | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const hookEventName = typeof raw.hook_event_name === 'string' ? raw.hook_event_name : '';
  if (!hookEventName) return null;
  const text = (value: unknown, limit = 160) => typeof value === 'string' && value ? value.replace(SECRET, (match, label?: string) => label ? `${label}=[REDACTED]` : '[REDACTED]').slice(0, limit) : undefined;
  const phase: ClaudeRuntimeEvent['phase'] = hookEventName === 'UserPromptSubmit' ? 'prompt' : hookEventName === 'PreToolUse' ? 'started' : hookEventName === 'PostToolUse' || hookEventName === 'PostToolUseFailure' || hookEventName === 'Stop' ? 'completed' : hookEventName === 'PermissionRequest' || hookEventName === 'PermissionDenied' ? 'permission' : 'lifecycle';
  const hookOutput = raw.hook_specific_output && typeof raw.hook_specific_output === 'object' ? raw.hook_specific_output as Record<string, unknown> : {};
  return {
    provider: 'claude', source: 'claude-hook', eventId: randomUUID(), hookEventName: hookEventName.slice(0, 80),
    sessionId: text(raw.session_id, 120), toolUseId: text(raw.tool_use_id, 160), toolName: text(raw.tool_name, 200),
    cwd: text(raw.cwd, 500), model: text(raw.model), reasoningEffort: effort(raw.effort) || effort(raw.reasoning_effort) || effort(hookOutput.effort) || effort(hookOutput.reasoning_effort), permissionMode: text(raw.permission_mode), agentId: text(raw.agent_id), agentType: text(raw.agent_type), phase,
    hasToolResponse: raw.tool_response !== undefined, permissionDecision: hookEventName === 'PermissionDenied' ? 'denied' : undefined, timestamp: new Date().toISOString(), payload: safe(raw) as Record<string, unknown>,
  };
}

function withClaudeTurnId(event: ClaudeRuntimeEvent, history: ClaudeRuntimeEvent[]): ClaudeRuntimeEvent {
  if (event.sessionId) {
    const sessionStart = [...history].reverse().find(candidate => candidate.sessionId === event.sessionId && candidate.hookEventName === 'SessionStart');
    if (sessionStart) event = { ...event, model: event.model || sessionStart.model, reasoningEffort: event.reasoningEffort || sessionStart.reasoningEffort };
  }
  if (event.turnId || !event.sessionId) return event;
  if (event.hookEventName === 'UserPromptSubmit') return { ...event, turnId: `${event.sessionId}:${event.eventId}` };
  const previous = [...history].reverse().find(candidate => candidate.sessionId === event.sessionId && candidate.turnId);
  if (!previous) return event;
  const closed = history.some(candidate => candidate.sessionId === event.sessionId && candidate.turnId === previous.turnId && (candidate.hookEventName === 'Stop' || candidate.hookEventName === 'SessionEnd'));
  return closed ? event : { ...event, turnId: previous.turnId };
}

export function correlateClaudeRuntimeEvent(event: ClaudeRuntimeEvent, history: ClaudeRuntimeEvent[]): ClaudeRuntimeEvent {
  event = withClaudeTurnId(event, history);
  if (!event.toolUseId || (event.phase !== 'started' && event.phase !== 'completed')) return { ...event, correlationStatus: 'unpaired' };
  const wanted = event.phase === 'started' ? 'completed' : 'started';
  const other = [...history].reverse().find(candidate => candidate.phase === wanted && candidate.toolUseId === event.toolUseId && candidate.sessionId === event.sessionId && candidate.correlationStatus !== 'paired');
  if (!other) return { ...event, correlationStatus: event.phase === 'started' ? 'pending' : 'unpaired' };
  const observedIntervalMs = Math.abs(Date.parse(event.timestamp) - Date.parse(other.timestamp));
  other.correlationStatus = 'paired'; other.pairedEventId = event.eventId; other.observedIntervalMs = observedIntervalMs;
  return { ...event, correlationStatus: 'paired', pairedEventId: other.eventId, observedIntervalMs };
}

export function reconcileClaudeRuntimeHistory(events: ClaudeRuntimeEvent[]) {
  const history: ClaudeRuntimeEvent[] = [];
  for (const source of events) {
    const payload = source.payload || {};
    const event = withClaudeTurnId({ ...source, model: source.model || textValue(payload.model), reasoningEffort: source.reasoningEffort || effort(payload.effort) || effort(payload.reasoning_effort), correlationStatus: undefined, pairedEventId: undefined, observedIntervalMs: undefined }, history);
    history.push(correlateClaudeRuntimeEvent(event, history));
  }
  return history;
}

function textValue(value: unknown) { return typeof value === 'string' && value ? value.slice(0, 160) : undefined; }
