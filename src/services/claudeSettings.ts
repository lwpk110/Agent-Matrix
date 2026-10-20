export type ClaudeSettings = Record<string, unknown> & { hooks: Record<string, unknown> };
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest', 'PermissionDenied', 'PreCompact', 'SubagentStart', 'SubagentStop', 'Stop', 'SessionEnd'];
const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;
const commandFor = (hookPath?: string, hookUrl?: string) => `${hookUrl ? `AGENT_MATRIX_CLAUDE_HOOK_URL=${shellQuote(hookUrl)} ` : ''}node ${shellQuote(hookPath || '.claude/hooks/claude-runtime-hook.mjs')}`;

/** 仅追加本项目的 Hook，绝不替换用户已有的 Claude 配置。 */
export function mergeClaudeRuntimeSettings(input: Record<string, unknown>, hookPath?: string, hookUrl?: string): ClaudeSettings {
  const hooks: Record<string, unknown> = input.hooks && typeof input.hooks === 'object' && !Array.isArray(input.hooks) ? { ...(input.hooks as Record<string, unknown>) } : {};
  for (const event of EVENTS) {
    const legacy = hooks[event];
    // 早期项目使用字符串命令；迁移为官方 entry 后仍保留该命令的行为。
    const entries = Array.isArray(legacy) ? [...legacy] : typeof legacy === 'string'
      ? [{ matcher: '*', hooks: [{ type: 'command', command: legacy }] }]
      : [];
    const command = commandFor(hookPath, hookUrl);
    const replaceGeneratedCommand = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(replaceGeneratedCommand);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => {
        if (key !== 'command' || typeof child !== 'string' || !child.includes('claude-runtime-hook.mjs') || !hookUrl) return [key, replaceGeneratedCommand(child)];
        const urlPrefix = `AGENT_MATRIX_CLAUDE_HOOK_URL=${shellQuote(hookUrl)} `;
        if (/AGENT_MATRIX_CLAUDE_HOOK_URL='[^']*'/.test(child)) return [key, child.replace(/AGENT_MATRIX_CLAUDE_HOOK_URL='[^']*'/, urlPrefix.trimEnd())];
        if (child.startsWith('node ')) return [key, `${urlPrefix}${child}`];
        return [key, child];
      }));
    };
    const updatedEntries = entries.map(replaceGeneratedCommand);
    const exists = updatedEntries.some(entry => JSON.stringify(entry).includes('claude-runtime-hook.mjs'));
    if (!exists) updatedEntries.push({ matcher: '*', hooks: [{ type: 'command', command, async: true, timeout: 3 }] });
    hooks[event] = updatedEntries;
  }
  return { ...input, hooks };
}
