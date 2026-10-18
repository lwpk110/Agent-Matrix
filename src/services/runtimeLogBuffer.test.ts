import assert from 'node:assert/strict';
import test from 'node:test';
import type { LogEntry } from '../types/matrix';
import { appendRuntimeLog, pairRuntimeLogs } from './runtimeLogBuffer';

function log(id: string, runtime = true, sessionId = 'session-a', turnId = 'turn-a'): LogEntry {
  return {
    id, timestamp: '2026-10-17T10:00:00.000Z', agentTag: 'CODEX LIVE', agentColor: 'cyan', category: 'system', message: id,
    ...(runtime ? { runtimeEvent: {
      provider: 'codex', source: 'codex-hook', eventId: id, eventName: 'PreToolUse', sessionId, turnId,
      toolUseId: 'shared-call', phase: 'started', hasToolResponse: false, details: '{}',
    } } : {}),
  };
}

test('restores all 2000 gateway events and keeps dashboard noise from evicting the prompt', () => {
  let logs: LogEntry[] = [];
  for (let index = 0; index < 2000; index++) logs = appendRuntimeLog(logs, log(`runtime-${index}`));
  for (let index = 0; index < 200; index++) logs = appendRuntimeLog(logs, log(`dashboard-${index}`, false));
  assert.equal(logs.filter((entry) => entry.runtimeEvent).length, 2000);
  assert.equal(logs[0].id, 'runtime-0');
  assert.equal(logs.filter((entry) => !entry.runtimeEvent).length, 120);
  logs = appendRuntimeLog(logs, log('next-runtime'));
  assert.equal(logs[0].id, 'runtime-1');
});

test('updates only the exact paired event in the matching session and turn', () => {
  const logs = [log('original'), log('other-session', true, 'session-b'), log('other-turn', true, 'session-a', 'turn-b')];
  const incoming = { ...log('finish').runtimeEvent!, phase: 'completed' as const, correlationStatus: 'paired' as const, pairedEventId: 'original', observedIntervalMs: 42 };
  const updated = pairRuntimeLogs(logs, incoming);
  assert.equal(updated[0].runtimeEvent?.pairedEventId, 'finish');
  assert.equal(updated[0].runtimeEvent?.observedIntervalMs, 42);
  assert.equal(updated[1], logs[1]);
  assert.equal(updated[2], logs[2]);
});
