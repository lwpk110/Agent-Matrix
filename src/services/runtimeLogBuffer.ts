import type { LogEntry } from '../types/matrix';

export const CODEX_LOG_LIMIT = 2000;
const DASHBOARD_LOG_LIMIT = 120;

export function runtimeEventIdentity(event: { provider: string; sessionId?: string; turnId?: string; eventId?: string }) {
  return event.eventId ? [event.provider, event.sessionId || "", event.turnId || "", event.eventId].join("\u0000") : null;
}

export function rememberRuntimeEventIdentity(seen: Set<string>, event: { provider: string; sessionId?: string; turnId?: string; eventId?: string }, limit = 5000) {
  const identity = runtimeEventIdentity(event);
  if (!identity) return true;
  if (seen.has(identity)) return false;
  seen.add(identity);
  if (seen.size > limit) {
    const oldest = seen.values().next().value;
    if (oldest) seen.delete(oldest);
  }
  return true;
}

/** Dashboard activity must not evict the Codex history restored from the gateway. */
export function appendRuntimeLog(logs: LogEntry[], entry: LogEntry): LogEntry[] {
  let runtimeCount = 0;
  let dashboardCount = 0;
  return [...logs, entry].reverse().filter((log) => log.runtimeEvent
    ? ++runtimeCount <= CODEX_LOG_LIMIT
    : ++dashboardCount <= DASHBOARD_LOG_LIMIT).reverse();
}

/** Call identifiers can be reused by other sessions and turns. */
export function pairRuntimeLogs(logs: LogEntry[], incoming: NonNullable<LogEntry['runtimeEvent']>): LogEntry[] {
  if (!incoming.toolUseId || incoming.correlationStatus !== 'paired' || !incoming.pairedEventId) return logs;
  return logs.map((log) => {
    const other = log.runtimeEvent;
    if (!other || other.provider !== incoming.provider || other.eventId !== incoming.pairedEventId || other.sessionId !== incoming.sessionId ||
      other.toolUseId !== incoming.toolUseId || (other.turnId && incoming.turnId && other.turnId !== incoming.turnId)) return log;
    return { ...log, runtimeEvent: { ...other, correlationStatus: 'paired', pairedEventId: incoming.eventId, observedIntervalMs: incoming.observedIntervalMs } };
  });
}
