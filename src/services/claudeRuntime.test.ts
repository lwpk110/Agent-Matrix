import assert from 'node:assert/strict';
import test from 'node:test';
import { correlateClaudeRuntimeEvent, normalizeClaudeHookPayload } from './claudeRuntime';

test('规范化 Claude Code 官方 Hook 生命周期并隔离私有字段', () => {
  const event = normalizeClaudeHookPayload({
    hook_event_name: 'PreToolUse',
    session_id: 'claude-session',
    transcript_path: '/private/transcript.jsonl',
    tool_use_id: 'tool-1',
    tool_name: 'Bash',
    tool_input: { command: 'echo token=super-secret-token' },
  });

  assert.equal(event?.provider, 'claude');
  assert.equal(event?.source, 'claude-hook');
  assert.equal(event?.phase, 'started');
  assert.equal(event?.toolUseId, 'tool-1');
  assert.equal(event?.toolName, 'Bash');
  assert.equal('transcript_path' in (event?.payload || {}), false);
  assert.doesNotMatch(JSON.stringify(event), /super-secret-token|private\/transcript/);
});

test('仅保留工具响应存在标记，不持久化命令输出或文件正文', () => {
  const event = normalizeClaudeHookPayload({
    hook_event_name: 'PostToolUse',
    tool_response: { content: 'private file contents' },
    stdout: 'private command output',
    output: 'private tool output',
  });
  assert.equal(event?.hasToolResponse, true);
  assert.doesNotMatch(JSON.stringify(event), /private file contents|private command output|private tool output/);
});

test('按会话和 tool_use_id 关联 Claude 工具调用', () => {
  const start = normalizeClaudeHookPayload({ hook_event_name: 'PreToolUse', session_id: 'a', tool_use_id: 'call-1', tool_name: 'Read' });
  const finish = normalizeClaudeHookPayload({ hook_event_name: 'PostToolUse', session_id: 'a', tool_use_id: 'call-1', tool_name: 'Read' });
  assert.ok(start && finish);
  start.timestamp = '2026-10-20T00:00:00.000Z';
  finish.timestamp = '2026-10-20T00:00:00.120Z';
  const pending = correlateClaudeRuntimeEvent(start, []);
  const completed = correlateClaudeRuntimeEvent(finish, [pending]);
  assert.equal(completed.correlationStatus, 'paired');
  assert.equal(completed.observedIntervalMs, 120);
  assert.equal(pending.pairedEventId, finish.eventId);
});

test('不接受缺少官方 Hook 名称的 Claude 数据', () => {
  assert.equal(normalizeClaudeHookPayload({ session_id: 'a' }), null);
});

test('采集官方可见的失败和子代理生命周期字段，不采 transcript 或私有推理', () => {
  const failed = normalizeClaudeHookPayload({
    hook_event_name: 'PostToolUseFailure', session_id: 'claude-a', tool_use_id: 'call-a', tool_name: 'Bash', cwd: '/work', model: 'claude-sonnet', permission_mode: 'default',
  });
  const stopped = normalizeClaudeHookPayload({ hook_event_name: 'SubagentStop', session_id: 'claude-a', agent_id: 'worker-a', agent_type: 'worker', last_assistant_message: '已完成用户可见答复', transcript_path: '/private.jsonl', private_reasoning: 'hidden' });
  assert.equal(failed?.phase, 'completed');
  assert.equal(failed?.model, 'claude-sonnet');
  assert.equal(failed?.cwd, '/work');
  assert.equal(stopped?.agentId, 'worker-a');
  assert.equal(stopped?.payload.last_assistant_message, '已完成用户可见答复');
  assert.doesNotMatch(JSON.stringify(stopped), /private\.jsonl/);
});

test('根据提示提交和 Stop 为同一 Claude session 划分独立回合', async () => {
  const { reconcileClaudeRuntimeHistory } = await import('./claudeRuntime');
  const events = [
    normalizeClaudeHookPayload({ hook_event_name: 'UserPromptSubmit', session_id: 'session-1' })!,
    normalizeClaudeHookPayload({ hook_event_name: 'PreToolUse', session_id: 'session-1', tool_use_id: 'call-1' })!,
    normalizeClaudeHookPayload({ hook_event_name: 'Stop', session_id: 'session-1' })!,
    normalizeClaudeHookPayload({ hook_event_name: 'UserPromptSubmit', session_id: 'session-1' })!,
    normalizeClaudeHookPayload({ hook_event_name: 'PreToolUse', session_id: 'session-1', tool_use_id: 'call-2' })!,
  ];
  const history = reconcileClaudeRuntimeHistory(events);
  assert.ok(history[0].turnId);
  assert.equal(history[1].turnId, history[0].turnId);
  assert.notEqual(history[3].turnId, history[0].turnId);
  assert.equal(history[4].turnId, history[3].turnId);
});
