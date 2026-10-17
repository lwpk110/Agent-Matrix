import type { LogEntry } from '../types/matrix';

export const CODEX_LOG_LIMIT = 500;
const DASHBOARD_LOG_LIMIT = 120;

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
    if (!other || other.eventId !== incoming.pairedEventId || other.sessionId !== incoming.sessionId ||
      other.toolUseId !== incoming.toolUseId || (other.turnId && incoming.turnId && other.turnId !== incoming.turnId)) return log;
    return { ...log, runtimeEvent: { ...other, correlationStatus: 'paired', pairedEventId: incoming.eventId, observedIntervalMs: incoming.observedIntervalMs } };
  });
}
