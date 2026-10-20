import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeClaudeRuntimeSettings } from './claudeSettings';

test('合并 Claude Hook 设置时保留已有配置并保持幂等', () => {
  const source = { permissions: { allow: ['Bash(git status)'] }, hooks: { PreToolUse: 'curl -s http://127.0.0.1:7788/hook/pre', Stop: [{ hooks: [{ type: 'command', command: 'echo done' }] }] } };
  const once = mergeClaudeRuntimeSettings(source);
  const twice = mergeClaudeRuntimeSettings(once);
  assert.deepEqual(twice, once);
  assert.deepEqual(once.permissions, source.permissions);
  const pre = once.hooks.PreToolUse as Array<{ hooks: Array<{ command: string }> }>;
  assert.equal(pre[0].hooks[0].command, 'curl -s http://127.0.0.1:7788/hook/pre');
  assert.match(pre[1].hooks[0].command, /claude-runtime-hook\.mjs/);
  assert.ok(Array.isArray(once.hooks.Stop));
});

test('Hook 路径的 shell 元字符按字面值传递', () => {
  const settings = mergeClaudeRuntimeSettings({}, `/tmp/work space/$(touch /tmp/agent-matrix-shell-pwned)'hook.mjs`);
  const hooks = settings.hooks.PreToolUse as Array<{ hooks: Array<{ command: string }> }>;
  assert.ok(hooks[0].hooks[0].command.includes("'/tmp/work space/$(touch /tmp/agent-matrix-shell-pwned)'\"'\"'hook.mjs'"));
  assert.equal(hooks[0].hooks[0].command.includes('"/tmp/work space/$(touch'), false);
});

test('Claude Hook 命令固定使用配置的本地网关端口', () => {
  const settings = mergeClaudeRuntimeSettings({}, '/project/.claude/hooks/claude-runtime-hook.mjs', 'http://127.0.0.1:7790/hook/claude');
  const hooks = settings.hooks.PreToolUse as Array<{ hooks: Array<{ command: string }> }>;
  assert.ok(hooks[0].hooks[0].command.includes("AGENT_MATRIX_CLAUDE_HOOK_URL='http://127.0.0.1:7790/hook/claude'"));
});

test('重复安装时迁移项目 Hook 的旧网关端口', () => {
  const old = mergeClaudeRuntimeSettings({}, '/project/.claude/hooks/claude-runtime-hook.mjs', 'http://127.0.0.1:7788/hook/claude');
  const migrated = mergeClaudeRuntimeSettings(old, '/project/.claude/hooks/claude-runtime-hook.mjs', 'http://127.0.0.1:7790/hook/claude');
  const hooks = migrated.hooks.PreToolUse as Array<{ hooks: Array<{ command: string }> }>;
  assert.equal(hooks.length, 1);
  assert.ok(hooks[0].hooks[0].command.includes('7790/hook/claude'));
  assert.equal(hooks[0].hooks[0].command.includes('7788/hook/claude'), false);
});

test('迁移端口时保留项目 Hook 命令上的自定义参数', () => {
  const initial = mergeClaudeRuntimeSettings({}, '/project/.claude/hooks/claude-runtime-hook.mjs', 'http://127.0.0.1:7788/hook/claude');
  const hooks = initial.hooks.PreToolUse as Array<{ matcher: string; hooks: Array<{ type: string; command: string; async: boolean; timeout: number }> }>;
  hooks[0].hooks[0].command += ' --trace=custom';
  const migrated = mergeClaudeRuntimeSettings(initial, '/project/.claude/hooks/claude-runtime-hook.mjs', 'http://127.0.0.1:7790/hook/claude');
  const updated = migrated.hooks.PreToolUse as typeof hooks;
  assert.ok(updated[0].hooks[0].command.includes('7790/hook/claude'));
  assert.ok(updated[0].hooks[0].command.endsWith('--trace=custom'));
});
