import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readCodexRolloutTelemetry } from './codexRolloutTelemetry';

const jsonl = (...items: unknown[]) => `${items.map((item) => JSON.stringify(item)).join('\n')}\n`;

test('reads only the requested turn summary from a matching local rollout', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-rollout-'));
  const sessionId = '01a14488-b89e-71f1-8545-caae7f4d5f18';
  const turnId = '01a14fd8-459b-7461-a4d6-6a51c120bd3c';
  const file = path.join(root, `rollout-${sessionId}.jsonl`);
  await fs.writeFile(file, jsonl(
    { type: 'session_meta', payload: { session_id: sessionId, cwd: 'D:\\private\\workspace' } },
    { type: 'turn_context', payload: { turn_id: 'old-turn-0001', model: 'old-model', effort: 'low', summary: 'private prompt text' } },
    { type: 'token_usage_record', payload: { session_id: sessionId, turn_id: 'old-turn-0001', usage: { input_tokens: 10, output_tokens: 2 }, turn_token_usage: { input_tokens: 10, cached_input_tokens: 4, output_tokens: 2, reasoning_output_tokens: 1, total_tokens: 12 } } },
    { type: 'turn_context', payload: { turn_id: turnId, model: 'gpt-6.1-sol', effort: 'high', summary: 'never expose this prompt' } },
    { type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 7200, cached_input_tokens: 5100, output_tokens: 42, reasoning_output_tokens: 16 }, model_context_window: 258400 } } },
    { type: 'token_usage_record', payload: { session_id: sessionId, turn_id: turnId, response_id: 'response-1', usage: { input_tokens: 7200, cached_input_tokens: 5100, output_tokens: 42, reasoning_output_tokens: 16 }, turn_token_usage: { input_tokens: 7200, cached_input_tokens: 5100, output_tokens: 42, reasoning_output_tokens: 16, total_tokens: 7242 } } },
    { type: 'token_usage_record', payload: { session_id: sessionId, turn_id: turnId, response_id: 'response-2' } },
  ));

  try {
    const telemetry = await readCodexRolloutTelemetry(sessionId, turnId, root);
    assert.deepEqual(telemetry, {
      sessionId,
      turnId,
      model: 'gpt-6.1-sol',
      reasoningEffort: 'high',
      modelRequestCount: 2,
      requests: [
        { inputTokens: 7200, cachedInputTokens: 5100, outputTokens: 42, reasoningTokens: 16 },
        { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningTokens: null },
      ],
      turnUsage: { inputTokens: 7200, cachedInputTokens: 5100, outputTokens: 42, reasoningTokens: 16, totalTokens: 7242 },
      latestRequest: { inputTokens: 7200, cachedInputTokens: 5100, outputTokens: 42, reasoningTokens: 16 },
      contextWindowTokens: 258400,
    });
    assert.equal(JSON.stringify(telemetry).includes('private'), false);
    assert.equal(await readCodexRolloutTelemetry(sessionId, 'unknown-turn-001', root), null);

    await fs.appendFile(file, jsonl({ type: 'token_usage_record', payload: {
      session_id: sessionId,
      turn_id: turnId,
      response_id: 'response-2',
      usage: { input_tokens: 1800, cached_input_tokens: 1100, output_tokens: 28, reasoning_output_tokens: 8 },
      turn_token_usage: { input_tokens: 9000, cached_input_tokens: 6200, output_tokens: 70, reasoning_output_tokens: 22, total_tokens: 9070 },
    } }));
    const updated = await readCodexRolloutTelemetry(sessionId, turnId, root);
    assert.equal(updated?.turnUsage?.totalTokens, 9070);
    assert.equal(updated?.turnUsage?.inputTokens, 9000);
    assert.equal(updated?.modelRequestCount, 2);
    assert.deepEqual(updated?.requests, [
      { inputTokens: 7200, cachedInputTokens: 5100, outputTokens: 42, reasoningTokens: 16 },
      { inputTokens: 1800, cachedInputTokens: 1100, outputTokens: 28, reasoningTokens: 8 },
    ]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('rejects malformed ids and does not accept a filename without matching session metadata', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-rollout-'));
  try {
    assert.equal(await readCodexRolloutTelemetry('../outside', undefined, root), null);
    const sessionId = 'session-id-1234';
    await fs.writeFile(path.join(root, `rollout-${sessionId}.jsonl`), jsonl(
      { type: 'session_meta', payload: { session_id: 'another-session-id' } },
      { type: 'turn_context', payload: { turn_id: 'turn-id-1234', model: 'hidden-model', effort: 'high' } },
    ));
    assert.equal(await readCodexRolloutTelemetry(sessionId, undefined, root), null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
