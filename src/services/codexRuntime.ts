import { randomUUID } from 'node:crypto';

export interface CodexHookPayload {
  hook_event_name?: string;
  session_id?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: unknown;
  [key: string]: unknown;
}

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?[^\s"']{8,}/gi,
];
const SENSITIVE_FIELD = /^(?:(?:.+[_-])?)(?:api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|token|secret|password|passwd|authorization|auth[_-]?header|cookie|set[_-]?cookie|credential|credentials|private[_-]?key)$/i;

export function redactRuntimeText(value: string): string {
  const redacted = SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, (...matches: unknown[]) => {
    const label = typeof matches[1] === 'string' ? matches[1] : undefined;
    return label ? `${label}=[REDACTED]` : '[REDACTED]';
  }), value);
  return redacted.slice(0, 4000);
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth >= 5) return '[TRUNCATED]';
  if (typeof value === 'string') return redactRuntimeText(value);
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeValue(item, depth + 1));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !/transcript_path|rollout_path/i.test(key))
    .slice(0, 60)
    .map(([key, item]) => [key, SENSITIVE_FIELD.test(key) || /api.?key|secret|password|authorization/i.test(key) ? '[REDACTED]' : sanitizeValue(item, depth + 1)]));
}

export interface CodexRuntimeEvent {
  provider: 'codex';
  source: 'codex-hook' | 'codex-app-server';
  eventId: string;
  hookEventName: string;
  sessionId?: string;
  turnId?: string;
  toolUseId?: string;
  model?: string;
  permissionMode?: string;
  agentId?: string;
  agentType?: string;
  phase: 'prompt' | 'started' | 'completed' | 'permission' | 'lifecycle';
  hasToolResponse: boolean;
  toolInputKeys?: string[];
  permissionDecision?: string;
  correlationStatus?: 'pending' | 'paired' | 'unpaired';
  pairedEventId?: string;
  observedIntervalMs?: number;
  cwd?: string;
  timestamp: string;
  toolName?: string;
  payload: Record<string, unknown>;
}

export function correlateCodexRuntimeEvent(event: CodexRuntimeEvent, history: CodexRuntimeEvent[]): CodexRuntimeEvent {
  if (event.source === 'codex-app-server' && event.payload.timestampPrecision === 'turn-start') {
    return { ...event, correlationStatus: 'unpaired' };
  }
  if (!event.toolUseId || (event.phase !== 'started' && event.phase !== 'completed')) {
    return { ...event, correlationStatus: 'unpaired' };
  }

  const otherPhase = event.phase === 'started' ? 'completed' : 'started';
  const other = [...history].reverse().find((candidate) =>
    candidate.phase === otherPhase &&
    candidate.toolUseId === event.toolUseId &&
    candidate.sessionId === event.sessionId &&
    (!candidate.turnId || !event.turnId || candidate.turnId === event.turnId) &&
    candidate.correlationStatus !== 'paired'
  );
  if (!other) return { ...event, correlationStatus: event.phase === 'started' ? 'pending' : 'unpaired' };

  const observedIntervalMs = Math.abs(Date.parse(event.timestamp) - Date.parse(other.timestamp));
  other.correlationStatus = 'paired';
  other.pairedEventId = event.eventId;
  other.observedIntervalMs = observedIntervalMs;
  return { ...event, correlationStatus: 'paired', pairedEventId: other.eventId, observedIntervalMs };
}

/** Rebuild correlation fields after loading a persisted delivery journal. */
export function reconcileCodexRuntimeHistory(events: CodexRuntimeEvent[]): CodexRuntimeEvent[] {
  const history: CodexRuntimeEvent[] = [];
  for (const event of events) {
    const reset: CodexRuntimeEvent = {
      ...event,
      correlationStatus: undefined,
      pairedEventId: undefined,
      observedIntervalMs: undefined,
    };
    history.push(correlateCodexRuntimeEvent(reset, history));
  }
  return history;
}

export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  const normalized = address.toLowerCase().replace(/^::ffff:/, '');
  return normalized === '::1' || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

export function normalizeCodexHookPayload(input: unknown): CodexRuntimeEvent | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as CodexHookPayload;
  const hookEventName = typeof raw.hook_event_name === 'string' ? raw.hook_event_name : '';
  if (!hookEventName) return null;

  const eventPayload = raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
    ? raw.payload as Record<string, unknown>
    : {};
  const field = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && value.length > 0)?.slice(0, 160);
  const toolInput = raw.tool_input ?? eventPayload.tool_input;
  const toolInputKeys = toolInput && typeof toolInput === 'object' && !Array.isArray(toolInput)
    ? Object.keys(toolInput as Record<string, unknown>).slice(0, 24)
    : undefined;
  const phase: CodexRuntimeEvent['phase'] = hookEventName === 'UserPromptSubmit'
    ? 'prompt'
    : hookEventName === 'PreToolUse'
      ? 'started'
      : hookEventName === 'PostToolUse'
        ? 'completed'
        : hookEventName === 'PermissionRequest'
          ? 'permission'
          : 'lifecycle';
  const hookOutput = raw.hook_specific_output ?? eventPayload.hook_specific_output;
  const permissionDecision = hookOutput && typeof hookOutput === 'object' && !Array.isArray(hookOutput)
    ? field((hookOutput as Record<string, unknown>).permissionDecision, (hookOutput as Record<string, unknown>).permission_decision)
    : field(raw.permission_decision, eventPayload.permission_decision);

  let safePayload = sanitizeValue(raw) as Record<string, unknown>;
  const serializedPayload = JSON.stringify(safePayload);
  if (serializedPayload.length > 50000) {
    safePayload = {
      hook_event_name: hookEventName,
      session_id: raw.session_id,
      cwd: raw.cwd,
      tool_name: raw.tool_name,
      truncated: true,
      preview: serializedPayload.slice(0, 12000),
    };
  }
  return {
    provider: 'codex',
    source: 'codex-hook',
    eventId: randomUUID(),
    hookEventName: hookEventName.slice(0, 80),
    sessionId: typeof raw.session_id === 'string' ? raw.session_id.slice(0, 120) : undefined,
    turnId: field(raw.turn_id, eventPayload.turn_id),
    toolUseId: field(raw.tool_use_id, raw.call_id, raw.tool_call_id, eventPayload.tool_use_id, eventPayload.call_id, eventPayload.tool_call_id),
    model: field(raw.model, eventPayload.model),
    permissionMode: field(raw.permission_mode, eventPayload.permission_mode),
    agentId: field(raw.agent_id, eventPayload.agent_id),
    agentType: field(raw.agent_type, eventPayload.agent_type),
    phase,
    hasToolResponse: raw.tool_response !== undefined || eventPayload.tool_response !== undefined,
    toolInputKeys,
    permissionDecision,
    cwd: typeof raw.cwd === 'string' ? redactRuntimeText(raw.cwd).slice(0, 500) : undefined,
    timestamp: new Date().toISOString(),
    toolName: typeof (raw.tool_name ?? eventPayload.tool_name) === 'string'
      ? redactRuntimeText((raw.tool_name ?? eventPayload.tool_name) as string).slice(0, 200)
      : undefined,
    payload: safePayload,
  };
}
