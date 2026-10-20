import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCodexAppServerItem } from './codexAppServer';

const thread = { id: 'thread-a', updatedAt: 1, cwd: 'D:/workspace/repo' };
const turn = { id: 'turn-a', startedAt: 1_792_225_083 };

test('captures readable prompt text and explicitly selected skills without local attachment paths', () => {
  const events = normalizeCodexAppServerItem(thread, turn, {
    type: 'userMessage',
    id: 'item-a',
    content: [
      { type: 'text', text: 'Inspect the runtime flow', text_elements: [] },
      { type: 'skill', name: 'browser', path: 'C:/Users/private/.codex/skills/browser/SKILL.md' },
      { type: 'localImage', path: 'C:/Users/private/Desktop/private.png' },
    ],
  }, 0);

  assert.equal(events.length, 2);
  assert.equal(events[0].hookEventName, 'UserPromptSubmit');
  assert.equal(events[0].payload.prompt, 'Inspect the runtime flow');
  assert.equal(events[1].hookEventName, 'SkillActivated');
  assert.equal(events[1].toolName, 'browser');
  assert.doesNotMatch(JSON.stringify(events), /C:\/Users\/private/);
});

test('preserves user prompt text up to the Hook redaction limit while redacting secrets', () => {
  const prompt = `${'x'.repeat(1500)} api_key=supersecret123 ${'y'.repeat(3000)}`;
  const [event] = normalizeCodexAppServerItem(thread, turn, {
    type: 'userMessage',
    id: 'long-prompt',
    content: [{ type: 'text', text: prompt }],
  }, 1);

  const captured = event.payload.prompt as string;
  assert.equal(captured.length, 4000);
  assert.ok(captured.startsWith('x'.repeat(1500)));
  assert.ok(captured.includes('api_key=[REDACTED]'));
  assert.equal(captured.includes('supersecret123'), false);
});

test('records hosted search metadata without retaining result bodies', () => {
  const [event] = normalizeCodexAppServerItem(thread, turn, {
    type: 'webSearch',
    id: 'search-a',
    query: 'Codex app-server notifications',
    action: { type: 'search' },
    results: [{ title: 'Protocol reference', url: 'https://example.test', snippet: 'sensitive body' }],
  }, 2);

  assert.equal(event.hookEventName, 'AppServerWebSearch');
  assert.equal(event.payload.resultCount, 1);
  assert.equal(event.payload.query, 'Codex app-server notifications');
  assert.doesNotMatch(JSON.stringify(event), /sensitive body|example\.test/);
});

test('redacts MCP credentials and excludes tool results', () => {
  const [event] = normalizeCodexAppServerItem(thread, turn, {
    type: 'mcpToolCall',
    id: 'mcp-a',
    server: 'docs',
    tool: 'search',
    status: 'completed',
    arguments: { access_token: 'secret-value-123', query: 'runtime' },
    result: { content: [{ type: 'text', text: 'private result payload' }] },
  }, 3);

  assert.equal(event.toolName, 'docs/search');
  assert.equal(event.payload.arguments && (event.payload.arguments as Record<string, unknown>).access_token, '[REDACTED]');
  assert.doesNotMatch(JSON.stringify(event), /secret-value-123|private result payload/);
});

test('preserves changed app-server tool snapshots while keeping stable event IDs for repeats', () => {
  const item = { type: 'mcpToolCall', id: 'mcp-live', server: 'docs', tool: 'search', arguments: { query: 'runtime' } };
  const [started] = normalizeCodexAppServerItem(thread, turn, { ...item, status: 'inProgress' }, 8);
  const [repeatedStart] = normalizeCodexAppServerItem(thread, turn, { ...item, status: 'inProgress' }, 8);
  const [completed] = normalizeCodexAppServerItem(thread, turn, { ...item, status: 'completed', durationMs: 420 }, 8);

  assert.equal(started.phase, 'started');
  assert.equal(completed.phase, 'completed');
  assert.equal(started.toolUseId, completed.toolUseId);
  assert.equal(started.eventId, repeatedStart.eventId);
  assert.notEqual(started.eventId, completed.eventId);
});

test('never promotes model reasoning or hidden hook prompt bodies into runtime events', () => {
  assert.deepEqual(normalizeCodexAppServerItem(thread, turn, {
    type: 'reasoning', id: 'reason-a', summary: ['private reasoning'], content: ['hidden thought'],
  }, 4), []);
  assert.deepEqual(normalizeCodexAppServerItem(thread, turn, {
    type: 'hookPrompt', id: 'hook-prompt-a', fragments: [{ text: 'private injected context', hookRunId: 'hook-a' }],
  }, 5), []);
});

test('captures final answers and subagent lifecycle without internal reasoning', () => {
  const [answer] = normalizeCodexAppServerItem(thread, turn, {
    type: 'agentMessage', id: 'answer-a', phase: 'final_answer', text: 'The task is complete.',
  }, 6);
  const [agent] = normalizeCodexAppServerItem(thread, turn, {
    type: 'subAgentActivity', id: 'agent-a', kind: 'started', agentThreadId: 'child-a', agentPath: 'root/worker',
  }, 7);

  assert.equal(answer.hookEventName, 'AppServerFinalAnswer');
  assert.equal(answer.payload.text, 'The task is complete.');
  assert.equal(agent.hookEventName, 'AppServerSubAgentActivity');
  assert.equal(agent.payload.agentThreadId, 'child-a');
  assert.equal(agent.payload.agentPath, undefined);
});
