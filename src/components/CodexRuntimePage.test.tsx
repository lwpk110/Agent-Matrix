import assert from 'node:assert/strict';
import test from 'node:test';
import { LogEntry } from '../types/matrix';
import { buildChain, groupSessions } from './CodexRuntimePage';

function runtimeLog(eventId: string, eventName: string, turnId: string | undefined, timestamp: string): LogEntry {
  return {
    id: eventId,
    timestamp,
    agentTag: 'CODEX LIVE',
    agentColor: 'cyan',
    category: 'system',
    message: eventName,
    runtimeEvent: {
      provider: 'codex',
      source: 'codex-hook',
      eventId,
      eventName,
      sessionId: 'session-1',
      turnId,
      phase: eventName === 'UserPromptSubmit' ? 'prompt' : 'lifecycle',
      hasToolResponse: false,
      timestamp,
      details: JSON.stringify({ hook_event_name: eventName }),
    },
  };
}

test('groups Codex task history by real turn id and keeps session events with the first turn', () => {
  const logs = [
    runtimeLog('session', 'SessionStart', undefined, '2026-10-17T10:00:00.000Z'),
    runtimeLog('prompt-a', 'UserPromptSubmit', 'turn-a', '2026-10-17T10:00:01.000Z'),
    runtimeLog('stop-a', 'Stop', 'turn-a', '2026-10-17T10:00:02.000Z'),
    runtimeLog('tool-b', 'PreToolUse', 'turn-b', '2026-10-17T10:00:03.000Z'),
  ];

  const groups = groupSessions(logs);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].turnId, 'turn-b');
  assert.deepEqual(groups[0].events.map((event) => event.id), ['tool-b']);
  assert.equal(groups[1].turnId, 'turn-a');
  assert.deepEqual(groups[1].events.map((event) => event.id), ['session', 'prompt-a', 'stop-a']);
});

test('shows an explicit missing prompt step and preserves unrecognized Hook events', () => {
  const events = [runtimeLog('setup', 'SetupStart', 'turn-b', '2026-10-17T10:00:00.000Z')];
  const chain = buildChain(events, true);

  assert.equal(chain.length, 2);
  assert.equal(chain[0].status, 'unavailable');
  assert.ok(chain[0].tags.includes('MISSING PROMPT'));
  assert.match(chain[0].title, /输入未被 Hook 捕获/);
  assert.match(chain[1].title, /SetupStart/);
  assert.ok(chain[1].tags.includes('HOOK'));
});
