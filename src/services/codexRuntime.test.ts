import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import test from 'node:test';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { correlateCodexRuntimeEvent, isLoopbackAddress, normalizeCodexHookPayload, reconcileCodexRuntimeHistory, redactRuntimeText } from './codexRuntime';

test('normalizes real Codex lifecycle payloads and preserves prompt and tool details', () => {
  const event = normalizeCodexHookPayload({
    hook_event_name: 'UserPromptSubmit',
    session_id: 'thread-123',
    turn_id: 'turn-456',
    cwd: 'D:/workspace/project',
    prompt: 'Find the failing test and fix it',
  });

  assert.equal(event?.provider, 'codex');
  assert.equal(event?.source, 'codex-hook');
  assert.match(event?.eventId || '', /^[0-9a-f-]{36}$/);
  assert.equal(event?.hookEventName, 'UserPromptSubmit');
  assert.equal(event?.sessionId, 'thread-123');
  assert.equal(event?.turnId, 'turn-456');
  assert.equal(event?.payload.prompt, 'Find the failing test and fix it');
  assert.ok(event?.timestamp);
});

test('correlates tool lifecycle events with nested turn and call identifiers', () => {
  const event = normalizeCodexHookPayload({
    hook_event_name: 'PostToolUse',
    session_id: 'thread-123',
    payload: {
      turn_id: 'turn-456',
      call_id: 'call-789',
      tool_name: 'exec_command',
      model: 'gpt-5-codex',
      permission_mode: 'workspace-write',
      agent_id: 'agent-42',
      agent_type: 'explorer',
      tool_input: { command: 'git status' },
    },
  });

  assert.equal(event?.turnId, 'turn-456');
  assert.equal(event?.toolUseId, 'call-789');
  assert.equal(event?.toolName, 'exec_command');
  assert.equal(event?.model, 'gpt-5-codex');
  assert.equal(event?.permissionMode, 'workspace-write');
  assert.equal(event?.agentId, 'agent-42');
  assert.equal(event?.agentType, 'explorer');
  assert.equal(event?.phase, 'completed');
  assert.equal(event?.hasToolResponse, false);
  assert.deepEqual(event?.toolInputKeys, ['command']);
});

test('marks PostToolUse responses and PermissionRequest decisions without exposing raw output', () => {
  const event = normalizeCodexHookPayload({
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'git status' },
    tool_response: 'clean',
  });
  assert.equal(event?.phase, 'completed');
  assert.equal(event?.hasToolResponse, true);
  assert.deepEqual(event?.toolInputKeys, ['command']);
  const permission = normalizeCodexHookPayload({
    hook_event_name: 'PermissionRequest',
    permission_decision: 'ask',
  });
  assert.equal(permission?.phase, 'permission');
  assert.equal(permission?.permissionDecision, 'ask');
});

test('correlates PreToolUse and PostToolUse by toolUseId and computes duration', () => {
  const start = normalizeCodexHookPayload({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: 'call-1' });
  const finish = normalizeCodexHookPayload({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_use_id: 'call-1', tool_response: 'ok' });
  assert.ok(start && finish);
  start.timestamp = '2026-01-01T00:00:00.000Z';
  finish.timestamp = '2026-01-01T00:00:00.125Z';
  const pending = correlateCodexRuntimeEvent(start, []);
  const completed = correlateCodexRuntimeEvent(finish, [pending]);
  assert.equal(completed.correlationStatus, 'paired');
  assert.equal(completed.pairedEventId, start.eventId);
  assert.equal(completed.observedIntervalMs, 125);
  assert.equal(pending.correlationStatus, 'paired');
  assert.equal(pending.pairedEventId, finish.eventId);
  assert.equal(pending.observedIntervalMs, 125);
});

test('correlates out-of-order async hook delivery without calling receipt interval execution time', () => {
  const finish = normalizeCodexHookPayload({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_use_id: 'call-late' });
  const start = normalizeCodexHookPayload({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: 'call-late' });
  assert.ok(start && finish);
  finish.timestamp = '2026-01-01T00:00:00.100Z';
  start.timestamp = '2026-01-01T00:00:00.125Z';
  const unmatchedFinish = correlateCodexRuntimeEvent(finish, []);
  assert.equal(unmatchedFinish.correlationStatus, 'unpaired');
  const pairedStart = correlateCodexRuntimeEvent(start, [unmatchedFinish]);
  assert.equal(pairedStart.correlationStatus, 'paired');
  assert.equal(pairedStart.observedIntervalMs, 25);
  assert.equal(unmatchedFinish.correlationStatus, 'paired');
  assert.equal(unmatchedFinish.pairedEventId, start.eventId);
});

test('does not pair reused call ids across Codex sessions or turns', () => {
  const first = normalizeCodexHookPayload({ hook_event_name: 'PreToolUse', session_id: 'session-a', turn_id: 'turn-a', tool_use_id: 'shared-call' });
  const otherSession = normalizeCodexHookPayload({ hook_event_name: 'PostToolUse', session_id: 'session-b', turn_id: 'turn-a', tool_use_id: 'shared-call' });
  const otherTurn = normalizeCodexHookPayload({ hook_event_name: 'PostToolUse', session_id: 'session-a', turn_id: 'turn-b', tool_use_id: 'shared-call' });
  assert.ok(first && otherSession && otherTurn);

  const pending = correlateCodexRuntimeEvent(first, []);
  const sessionFinish = correlateCodexRuntimeEvent(otherSession, [pending]);
  const turnFinish = correlateCodexRuntimeEvent(otherTurn, [pending, sessionFinish]);

  assert.equal(sessionFinish.correlationStatus, 'unpaired');
  assert.equal(turnFinish.correlationStatus, 'unpaired');
  assert.equal(pending.correlationStatus, 'pending');
});

test('rebuilds correlations when replaying a persisted delivery journal', () => {
  const start = normalizeCodexHookPayload({ hook_event_name: 'PreToolUse', session_id: 'session-replay', turn_id: 'turn-replay', tool_use_id: 'call-replay' });
  const finish = normalizeCodexHookPayload({ hook_event_name: 'PostToolUse', session_id: 'session-replay', turn_id: 'turn-replay', tool_use_id: 'call-replay' });
  assert.ok(start && finish);
  start.timestamp = '2026-01-01T00:00:00.000Z';
  finish.timestamp = '2026-01-01T00:00:00.200Z';

  const replayed = reconcileCodexRuntimeHistory([start, finish]);
  assert.equal(replayed[0].correlationStatus, 'paired');
  assert.equal(replayed[1].correlationStatus, 'paired');
  assert.equal(replayed[1].observedIntervalMs, 200);
});

test('redacts common credentials and excludes transcript file locations', () => {
  const event = normalizeCodexHookPayload({
    hook_event_name: 'PreToolUse',
    transcript_path: 'C:/private/session.jsonl',
    tool_name: 'Bash',
    tool_input: { command: 'curl -H "Authorization: Bearer abc.def.ghi"' },
  });

  assert.ok(event);
  assert.equal('transcript_path' in event.payload, false);
  assert.match(JSON.stringify(event.payload), /\[REDACTED\]/);
  assert.doesNotMatch(JSON.stringify(event.payload), /abc\.def\.ghi/);
  assert.equal(redactRuntimeText('token=sk-123456789012345678901234'), 'token=[REDACTED]');
});

test('redacts credential values in nested structured hook fields', () => {
  const event = normalizeCodexHookPayload({
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: {
      token: 'plain-token-value',
      refresh_token: 'refresh-token-value',
      apiKey: 'api-key-value',
      Authorization: 'Bearer opaque-value',
      nested: { private_key: 'private-key-value', safe: 'visible' },
    },
  });

  assert.ok(event);
  assert.deepEqual(event.payload.tool_input, {
    token: '[REDACTED]',
    refresh_token: '[REDACTED]',
    apiKey: '[REDACTED]',
    Authorization: '[REDACTED]',
    nested: { private_key: '[REDACTED]', safe: 'visible' },
  });
});

test('rejects payloads without a Codex hook event name', () => {
  assert.equal(normalizeCodexHookPayload({ tool_name: 'Bash' }), null);
  assert.equal(normalizeCodexHookPayload(null), null);
});

test('accepts IPv4 and IPv6 loopback addresses only', () => {
  for (const address of ['127.0.0.1', '127.0.0.9', '::1', '::ffff:127.0.0.1']) {
    assert.equal(isLoopbackAddress(address), true);
  }
  for (const address of ['192.168.1.20', '::ffff:192.168.1.20', undefined]) {
    assert.equal(isLoopbackAddress(address), false);
  }
});

test('Codex hook command forwards stdin JSON to the configured local endpoint', async (t) => {
  const payload = { hook_event_name: 'AgentMatrixTransportTest', session_id: 'transport-test' };
  let receivedPayload: unknown;
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    receivedPayload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    response.writeHead(202).end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const endpoint = `http://127.0.0.1:${address.port}/hook/codex`;
  const scriptPath = fileURLToPath(new URL('../../.codex/hooks/codex-runtime-hook.mjs', import.meta.url));
  const child = spawn(process.execPath, [scriptPath], {
    env: { ...process.env, AGENT_MATRIX_CODEX_HOOK_URL: endpoint },
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  const exited = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Hook process exited with ${code}`)));
  });
  child.stdin.end(JSON.stringify(payload));

  await exited;
  assert.deepEqual(receivedPayload, payload);
});
