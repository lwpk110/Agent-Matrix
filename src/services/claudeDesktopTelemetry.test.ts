import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { findClaudeSessionCwd, findClaudeTelemetry, readClaudeDesktopTelemetry, readClaudeProjectMemoryMetadata } from './claudeDesktopTelemetry';

const line = (value: unknown) => `${JSON.stringify(value)}\n`;

test('按 user 边界和 parent tree 聚合 Claude Code，并只投影统计元数据', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-metadata-'));
  const project = path.join(root, 'project');
  await fs.mkdir(project);
  await fs.writeFile(path.join(project, 'session.jsonl'), [
    { sessionId: 'session-1234', uuid: 'user-1', type: 'user', timestamp: '2026-10-21T10:00:00.000Z', entrypoint: 'cli', message: { content: 'private prompt' } },
    { sessionId: 'session-1234', uuid: 'assistant-1', parentUuid: 'user-1', type: 'assistant', timestamp: '2026-10-21T10:00:01.000Z', message: { id: 'request-1', model: 'claude-sonnet', content: 'private answer', usage: { input_tokens: 10, cache_creation_input_tokens: 4, cache_read_input_tokens: 6, output_tokens: 2 } }, tool_result: 'private tool' },
    { sessionId: 'session-1234', uuid: 'assistant-2', parentUuid: 'assistant-1', type: 'assistant', timestamp: '2026-10-21T10:00:02.000Z', message: { id: 'request-2', model: 'claude-sonnet', usage: { input_tokens: 12, cache_creation_input_tokens: 3, cache_read_input_tokens: 5, output_tokens: 4 } }, metadata: { effort: 'high' } },
    { sessionId: 'session-1234', uuid: 'assistant-duplicate', parentUuid: 'user-1', type: 'assistant', message: { id: 'request-2', usage: { input_tokens: 12, cache_creation_input_tokens: 3, cache_read_input_tokens: 5, output_tokens: 4 } } },
    { sessionId: 'session-1234', uuid: 'system-1', parentUuid: 'user-1', type: 'system', subtype: 'turn_duration', durationMs: 321 },
  ].map(line).join(''));
  try {
    const snapshot = readClaudeDesktopTelemetry({ root });
    assert.equal(snapshot.status, 'ready');
    assert.deepEqual(snapshot.sessions, [{
      source: 'claude-code', sessionId: 'session-1234', turnId: 'user-1', model: 'claude-sonnet', reasoningEffort: 'high', modelRequestCount: 2, latestRequest: { inputTokens: 20 }, contextMetadata: { instructionFileCount: null, observedAt: null, source: 'claude-transcript', scope: 'turn' }, promptMetadata: { systemSegmentCount: null, toolDefinitionCount: null, observedAt: null, source: 'claude-transcript', scope: 'turn' }, toolCallMetadata: [],
      turnUsage: { inputTokens: 40, cachedInputTokens: 11, outputTokens: 6, reasoningTokens: null, totalTokens: null, nativeInputTokens: 22, cacheCreationInputTokens: 7, cacheReadInputTokens: 11, usageSemantics: 'native-input-plus-cache-creation-plus-cache-read' }, durationMs: 321, timestamp: '2026-10-21T10:00:00.000Z',
    }]);
    assert.doesNotMatch(JSON.stringify(snapshot), /private|tool_result|content/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('仅将能由 Hook prompt id 或时间可靠匹配的 Hook 回合映射到 transcript user 边界', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-metadata-'));
  const project = path.join(root, 'project'); await fs.mkdir(project);
  await fs.writeFile(path.join(project, 'session.jsonl'), [
    { sessionId: 'session-5678', uuid: 'user-2', promptId: 'prompt-2', type: 'user', timestamp: '2026-10-21T11:00:00.000Z', entrypoint: 'claude-desktop-3p', message: { content: 'private prompt' } },
    { sessionId: 'session-5678', uuid: 'assistant-3', parentUuid: 'user-2', type: 'assistant', timestamp: '2026-10-21T11:00:03.000Z', message: { id: 'request-3', model: 'claude-opus', usage: { input_tokens: 9, output_tokens: 3 } } },
  ].map(line).join(''));
  try {
    const snapshot = readClaudeDesktopTelemetry({ root });
    assert.equal(snapshot.sessions[0]?.source, 'claude-desktop');
    const byPrompt = findClaudeTelemetry(snapshot, 'session-5678', 'hook-turn', [{ sessionId: 'session-5678', turnId: 'hook-turn', hookEventName: 'UserPromptSubmit', timestamp: '2026-10-21T11:00:01.000Z', payload: { prompt_id: 'prompt-2' } }]);
    assert.equal(byPrompt?.turnId, 'hook-turn');
    assert.equal(byPrompt?.model, 'claude-opus');
    assert.equal(findClaudeTelemetry(snapshot, 'session-5678', 'wrong-turn', [{ sessionId: 'session-5678', turnId: 'wrong-turn', hookEventName: 'UserPromptSubmit', timestamp: '2026-10-21T12:00:00.000Z', payload: {} }]), null);
    assert.equal(findClaudeTelemetry(snapshot, 'session-5678', 'uuid-is-not-prompt-id', [{ sessionId: 'session-5678', turnId: 'uuid-is-not-prompt-id', hookEventName: 'UserPromptSubmit', timestamp: 'invalid', payload: { uuid: 'user-2' } }]), null);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('投影最近模型请求的完整输入，并只统计当前项目 memory 文件元数据', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-metadata-'));
  const cwd = '/workspace/agent-matrix';
  const project = path.join(root, '-workspace-agent-matrix'); await fs.mkdir(project);
  const memory = path.join(project, 'memory'); await fs.mkdir(memory);
  await fs.writeFile(path.join(memory, 'one.md'), 'private memory content');
  await fs.writeFile(path.join(memory, 'two.json'), 'another private memory content');
  await fs.mkdir(path.join(root, '-workspace-other', 'memory'), { recursive: true });
  await fs.writeFile(path.join(root, '-workspace-other', 'memory', 'ignored.md'), 'other project');
  await fs.writeFile(path.join(project, 'session.jsonl'), [
    { sessionId: 'recent-input', uuid: 'user', type: 'user', entrypoint: 'cli', message: { content: 'private prompt' } },
    { sessionId: 'recent-input', uuid: 'assistant-old', parentUuid: 'user', type: 'assistant', timestamp: '2026-10-21T10:00:01.000Z', message: { id: 'old', usage: { input_tokens: 1, cache_creation_input_tokens: 2, cache_read_input_tokens: 3, output_tokens: 4 } } },
    { sessionId: 'recent-input', uuid: 'assistant-new', parentUuid: 'user', type: 'assistant', timestamp: '2026-10-21T10:00:02.000Z', message: { id: 'new', usage: { input_tokens: 10, cache_creation_input_tokens: 20, cache_read_input_tokens: 30, output_tokens: 40 } } },
  ].map(line).join(''));
  try {
    const telemetry = readClaudeDesktopTelemetry({ root }).sessions[0];
    assert.deepEqual(telemetry?.latestRequest, { inputTokens: 60 });
    const metadata = readClaudeProjectMemoryMetadata({ root, cwd });
    assert.deepEqual(metadata && { fileCount: metadata.fileCount, totalBytes: metadata.totalBytes, status: metadata.status }, { fileCount: 2, totalBytes: 52, status: 'present' });
    assert.doesNotMatch(JSON.stringify(metadata), /private|one\.md|two\.json|ignored/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('重复请求的晚到补块不改变最近请求，项目中间符号链接不可读取', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-metadata-'));
  const project = path.join(root, '-workspace-target'); const outside = path.join(root, 'outside');
  await fs.mkdir(outside); await fs.mkdir(path.join(outside, 'memory'));
  await fs.writeFile(path.join(outside, 'memory', 'private.md'), 'private');
  await fs.symlink(outside, project);
  const transcript = path.join(root, 'transcript'); await fs.mkdir(transcript);
  await fs.writeFile(path.join(transcript, 'session.jsonl'), [
    { sessionId: 'late-request', uuid: 'user', type: 'user', entrypoint: 'cli', message: { content: 'private' } },
    { sessionId: 'late-request', uuid: 'old', parentUuid: 'user', type: 'assistant', timestamp: '2026-10-21T10:00:01.000Z', message: { id: 'old', usage: { input_tokens: 1 } } },
    { sessionId: 'late-request', uuid: 'new', parentUuid: 'user', type: 'assistant', timestamp: '2026-10-21T10:00:02.000Z', message: { id: 'new', usage: { input_tokens: 10, cache_creation_input_tokens: 20, cache_read_input_tokens: 30 } } },
    { sessionId: 'late-request', uuid: 'old-late', parentUuid: 'user', type: 'assistant', timestamp: '2026-10-21T11:00:00.000Z', message: { id: 'old', usage: { cache_creation_input_tokens: 2, cache_read_input_tokens: 3 } } },
  ].map(line).join(''));
  try {
    assert.deepEqual(readClaudeDesktopTelemetry({ root }).sessions[0]?.latestRequest, { inputTokens: 60 });
    assert.equal(readClaudeProjectMemoryMetadata({ root, cwd: '/workspace/target' }).status, 'unavailable');
    assert.equal(findClaudeSessionCwd('session-cwd', [{ sessionId: 'session-cwd', cwd: '/first' }, { sessionId: 'session-cwd', cwd: '/latest' }]), '/latest');
    assert.equal(findClaudeSessionCwd('missing', [{ sessionId: 'session-cwd', cwd: '/latest' }]), null);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('仅从祖先链投影 instructions、prompt_snapshot 和去重工具元数据', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-metadata-')); const project = path.join(root, 'project'); await fs.mkdir(project);
  await fs.writeFile(path.join(project, 'session.jsonl'), [
    { sessionId: 'metadata-session', uuid: 'user', type: 'user', entrypoint: 'cli', timestamp: '2026-10-21T10:00:00.000Z', message: { content: 'private' } },
    { sessionId: 'metadata-session', uuid: 'instructions', parentUuid: 'user', type: 'system', timestamp: '2026-10-21T10:00:01.000Z', attachment: { type: 'instructions', files: ['a', 'b'] } },
    { sessionId: 'metadata-session', uuid: 'snapshot', parentUuid: 'instructions', type: 'system', timestamp: '2026-10-21T10:00:02.000Z', attachment: { type: 'prompt_snapshot', systemPrompt: ['one', 'two'], tools: [{ name: 'Bash' }, { name: 'Read' }] } },
    { sessionId: 'metadata-session', uuid: 'same-turn-sibling', parentUuid: 'user', type: 'system', timestamp: '2026-10-21T10:00:02.500Z', attachment: { type: 'prompt_snapshot', systemPrompt: ['must-not-inherit'], tools: [{ name: 'Nope' }] } },
    { sessionId: 'metadata-session', uuid: 'tool', parentUuid: 'snapshot', type: 'assistant', timestamp: '2026-10-21T10:00:03.000Z', message: { id: 'request', content: [{ type: 'tool_use', id: 'call-1', name: 'Bash', input: { sentinel: 'private' } }, { type: 'tool_use', id: 'call-1', name: 'Bash' }] } },
    { sessionId: 'metadata-session', uuid: 'result', parentUuid: 'tool', type: 'user', timestamp: '2026-10-21T10:00:04.000Z', message: { content: [{ type: 'tool_result', tool_use_id: 'call-1', is_error: true, content: 'private result' }] } },
    { sessionId: 'metadata-session', uuid: 'sibling', parentUuid: 'other-user', type: 'system', instructions: { files: ['should-not-count'] }, prompt_snapshot: { systemPrompt: ['sibling'], tools: [{ name: 'Nope' }] } },
    { sessionId: 'metadata-session', uuid: 'other-user', type: 'user', entrypoint: 'cli', message: { content: 'other' } },
  ].map(line).join(''));
  try {
    const telemetry = readClaudeDesktopTelemetry({ root }).sessions[0];
    assert.deepEqual(telemetry?.contextMetadata, { instructionFileCount: 2, observedAt: '2026-10-21T10:00:01.000Z', source: 'claude-transcript', scope: 'turn' });
    assert.deepEqual(telemetry?.promptMetadata, { systemSegmentCount: 2, toolDefinitionCount: 2, observedAt: '2026-10-21T10:00:02.000Z', source: 'claude-transcript', scope: 'turn' });
    assert.deepEqual(telemetry?.toolCallMetadata, [{ callId: 'call-1', name: 'Bash', resultObserved: true, isError: true, observedAt: '2026-10-21T10:00:04.000Z' }]);
    assert.doesNotMatch(JSON.stringify(telemetry), /private|should-not-count|Nope|sentinel/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('受控根缺失、禁用或不可用时明确区分状态', () => {
  assert.equal(readClaudeDesktopTelemetry({ root: '/definitely/missing/claude-root' }).status, 'missing');
  assert.equal(readClaudeDesktopTelemetry({ root: '/definitely/missing/claude-root', disabled: true }).status, 'disabled');
});

test('半行追加、截断轮换和符号链接不会污染增量统计', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-metadata-'));
  const project = path.join(root, 'project'); const file = path.join(project, 'session.jsonl');
  await fs.mkdir(project);
  const user = { sessionId: 'session-rotation', uuid: 'user-rotation', promptId: 'prompt-rotation', type: 'user', entrypoint: 'cli', message: { content: 'private' } };
  const assistant = { sessionId: 'session-rotation', uuid: 'assistant-rotation', parentUuid: 'user-rotation', type: 'assistant', message: { id: 'request-rotation', model: 'claude-haiku', usage: { input_tokens: 2, output_tokens: 1 } } };
  try {
    const partial = line(user); await fs.writeFile(file, partial.slice(0, -1));
    assert.equal(readClaudeDesktopTelemetry({ root }).sessions.length, 0);
    await fs.appendFile(file, `${partial.slice(-1)}${line(assistant)}`);
    assert.equal(readClaudeDesktopTelemetry({ root }).sessions[0]?.modelRequestCount, 1);
    await fs.writeFile(file, '');
    assert.equal(readClaudeDesktopTelemetry({ root }).sessions.length, 0);
    await fs.unlink(file);
    await fs.writeFile(file, `${line(user)}${line({ ...assistant, message: { ...assistant.message, id: 'request-after-rotate', usage: { input_tokens: 4, output_tokens: 2 } } })}`);
    const rotated = readClaudeDesktopTelemetry({ root }).sessions[0];
    assert.equal(rotated?.modelRequestCount, 1);
    assert.equal(rotated?.turnUsage?.inputTokens, null);
    assert.equal(rotated?.turnUsage?.nativeInputTokens, 4);
    await fs.symlink(file, path.join(project, 'ignored.jsonl'));
    assert.equal(readClaudeDesktopTelemetry({ root }).sessions.length, 1);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('长于缓存上限的父链仍保留完整回合，重复请求逐字段补全 usage', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-metadata-'));
  const project = path.join(root, 'project'); await fs.mkdir(project);
  const records: unknown[] = [{ sessionId: 'session-long', uuid: 'user-long', type: 'user', entrypoint: 'cli', message: { content: 'private' } }];
  let parent = 'user-long';
  for (let index = 0; index < 3005; index++) { const uuid = `attachment-${index}`; records.push({ sessionId: 'session-long', uuid, parentUuid: parent, type: 'attachment' }); parent = uuid; }
  records.push({ sessionId: 'session-long', uuid: 'assistant-a', parentUuid: parent, type: 'assistant', message: { id: 'request-long', model: 'claude-sonnet', usage: { input_tokens: 2 } } });
  records.push({ sessionId: 'session-long', uuid: 'assistant-b', parentUuid: parent, type: 'assistant', message: { id: 'request-long', usage: { cache_creation_input_tokens: 3, cache_read_input_tokens: 4, output_tokens: 5 } } });
  try {
    await fs.writeFile(path.join(project, 'session.jsonl'), records.map(line).join(''));
    const turn = readClaudeDesktopTelemetry({ root }).sessions[0];
    assert.equal(turn?.turnId, 'user-long');
    assert.equal(turn?.source, 'claude-code');
    assert.deepEqual(turn?.turnUsage, { inputTokens: 9, cachedInputTokens: 4, outputTokens: 5, reasoningTokens: null, totalTokens: null, nativeInputTokens: 2, cacheCreationInputTokens: 3, cacheReadInputTokens: 4, usageSemantics: 'native-input-plus-cache-creation-plus-cache-read' });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('缺失任一输入分量时不伪造合计，未知来源不被标为 Claude Code', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-metadata-'));
  const project = path.join(root, 'project'); await fs.mkdir(project);
  try {
    await fs.writeFile(path.join(project, 'session.jsonl'), [
      { sessionId: 'unknown-source', uuid: 'user-unknown', type: 'user', message: { content: 'private' } },
      { sessionId: 'unknown-source', uuid: 'assistant-unknown', parentUuid: 'user-unknown', type: 'assistant', message: { id: 'unknown-request', usage: { input_tokens: 1 } } },
      { sessionId: 'incomplete-usage', uuid: 'user-incomplete', type: 'user', entrypoint: 'cli', message: { content: 'private' } },
      { sessionId: 'incomplete-usage', uuid: 'assistant-incomplete', parentUuid: 'user-incomplete', type: 'assistant', message: { id: 'incomplete-request', usage: { input_tokens: 1, output_tokens: 2 } } },
    ].map(line).join(''));
    const sessions = readClaudeDesktopTelemetry({ root }).sessions;
    assert.equal(sessions.some(item => item.sessionId === 'unknown-source'), false);
    const incomplete = sessions.find(item => item.sessionId === 'incomplete-usage');
    assert.equal(incomplete?.turnUsage?.inputTokens, null);
    assert.equal(incomplete?.turnUsage?.nativeInputTokens, 1);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('同一回合存在未采集 usage 的模型请求时，整回合 usage 保持未采集', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-metadata-'));
  const project = path.join(root, 'project'); await fs.mkdir(project);
  try {
    await fs.writeFile(path.join(project, 'session.jsonl'), [
      { sessionId: 'usage-gap', uuid: 'user-gap', type: 'user', entrypoint: 'cli', message: { content: 'private' } },
      { sessionId: 'usage-gap', uuid: 'assistant-complete', parentUuid: 'user-gap', type: 'assistant', message: { id: 'complete-request', usage: { input_tokens: 1, cache_creation_input_tokens: 2, cache_read_input_tokens: 3, output_tokens: 4 } } },
      { sessionId: 'usage-gap', uuid: 'assistant-missing', parentUuid: 'user-gap', type: 'assistant', message: { id: 'missing-request', model: 'claude-sonnet' } },
    ].map(line).join(''));
    const turn = readClaudeDesktopTelemetry({ root }).sessions[0];
    assert.equal(turn?.modelRequestCount, 2);
    assert.deepEqual(turn?.turnUsage, { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningTokens: null, totalTokens: null, nativeInputTokens: null, cacheCreationInputTokens: null, cacheReadInputTokens: null, usageSemantics: 'native-input-plus-cache-creation-plus-cache-read' });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('超出单轮读取预算时持续保留最新会话并明确 partial', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-metadata-'));
  const project = path.join(root, 'project'); await fs.mkdir(project);
  const padding = `${JSON.stringify({ ignored: 'x'.repeat(2048) })}\n`.repeat(300);
  try {
    for (let index = 0; index < 5; index++) {
      const file = path.join(project, `history-${index}.jsonl`);
      const prefix = index === 4 ? [
        { sessionId: 'latest-session', uuid: 'latest-user', type: 'user', entrypoint: 'claude-desktop-3p', message: { content: 'private' } },
        { sessionId: 'latest-session', uuid: 'latest-assistant', parentUuid: 'latest-user', type: 'assistant', message: { id: 'latest-request', model: 'claude-sonnet', usage: { input_tokens: 1, cache_creation_input_tokens: 2, cache_read_input_tokens: 3, output_tokens: 4 } } },
      ].map(line).join('') : '';
      await fs.writeFile(file, `${prefix}${padding}`);
      await fs.utimes(file, new Date(1_000 + index * 1_000), new Date(1_000 + index * 1_000));
    }
    const first = readClaudeDesktopTelemetry({ root });
    const second = readClaudeDesktopTelemetry({ root });
    assert.equal(first.partial, true);
    assert.equal(second.partial, undefined);
    assert.equal(first.sessions.some(item => item.sessionId === 'latest-session'), true);
    assert.equal(second.sessions.some(item => item.sessionId === 'latest-session'), true);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('超过全局节点缓存时保留最新会话，并稳定标记已截断的旧窗口', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-metadata-'));
  const project = path.join(root, 'project'); await fs.mkdir(project);
  try {
    for (let fileIndex = 0; fileIndex < 10; fileIndex++) {
      const sessionId = `window-session-${fileIndex}`;
      const records: unknown[] = [{ sessionId, uuid: `user-${fileIndex}`, type: 'user', entrypoint: fileIndex === 9 ? 'claude-desktop-3p' : 'cli', message: { content: 'private' } }];
      let parent = `user-${fileIndex}`;
      for (let index = 0; index < 3001; index++) { const uuid = `link-${fileIndex}-${index}`; records.push({ sessionId, uuid, parentUuid: parent, type: 'attachment' }); parent = uuid; }
      records.push({ sessionId, uuid: `assistant-${fileIndex}`, parentUuid: parent, type: 'assistant', message: { id: `request-${fileIndex}`, usage: { input_tokens: 1, cache_creation_input_tokens: 1, cache_read_input_tokens: 1, output_tokens: 1 } } });
      const file = path.join(project, `window-${fileIndex}.jsonl`);
      await fs.writeFile(file, records.map(line).join(''));
      await fs.utimes(file, new Date(10_000 + fileIndex * 1_000), new Date(10_000 + fileIndex * 1_000));
    }
    let snapshot = readClaudeDesktopTelemetry({ root });
    for (let index = 0; index < 4; index++) snapshot = readClaudeDesktopTelemetry({ root });
    assert.equal(snapshot.sessions.some(item => item.sessionId === 'window-session-9'), true);
    assert.equal(snapshot.truncated, true);
    const next = readClaudeDesktopTelemetry({ root });
    assert.equal(next.sessions.some(item => item.sessionId === 'window-session-9'), true);
    assert.equal(next.truncated, true);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});


test('快照 scope 按被选择节点是否跨越当前回合判定，祖先乱序不影响最近快照', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-scope-'));
  await fs.mkdir(path.join(root, 'project'));
  const record = (uuid: string, parentUuid: string | null, type: string, extra: object = {}) => ({ sessionId: 'scope-session', uuid, parentUuid, type, ...extra });
  await fs.writeFile(path.join(root, 'project', 'session.jsonl'), [
    record('old-user', null, 'user', { entrypoint: 'cli', message: { content: 'PRIVATE_PROMPT' } }),
    record('old-rule', 'old-user', 'attachment', { attachment: { type: 'instructions', files: [{ path: 'PRIVATE_PATH', content: 'PRIVATE_RULE' }] } }),
    record('user', 'old-rule', 'user', { entrypoint: 'cli', promptId: 'scope-prompt', message: { content: 'PRIVATE_PROMPT' } }),
    record('new-prompt', 'old-prompt', 'attachment', { attachment: { type: 'prompt_snapshot', systemPrompt: [], tools: [] } }),
    record('old-prompt', 'user', 'attachment', { attachment: { type: 'prompt_snapshot', systemPrompt: ['PRIVATE_SYSTEM'], tools: [{ name: 'PRIVATE_TOOL_DEFINITION' }] } }),
    record('request', 'new-prompt', 'assistant', { message: { id: 'scope-request', model: 'test-model', content: [] } }),
  ].map(line).join(''));
  try {
    const value = readClaudeDesktopTelemetry({ root }).sessions.find(item => item.turnId === 'user');
    assert.equal(value?.contextMetadata?.scope, 'session');
    assert.equal(value?.contextMetadata?.instructionFileCount, 1);
    assert.equal(value?.promptMetadata?.scope, 'turn');
    assert.equal(value?.promptMetadata?.systemSegmentCount, 0);
    assert.equal(value?.promptMetadata?.toolDefinitionCount, 0);
    assert.doesNotMatch(JSON.stringify(value), /PRIVATE/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
