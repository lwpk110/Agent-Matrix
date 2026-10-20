import { stdin } from 'node:process';

const chunks = [];
for await (const chunk of stdin) chunks.push(chunk);
try {
  const response = await fetch(process.env.AGENT_MATRIX_CLAUDE_HOOK_URL || 'http://127.0.0.1:7788/hook/claude', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: Buffer.concat(chunks), signal: AbortSignal.timeout(1200),
  });
  await response.body?.cancel();
} catch {
  // 遥测失败不能阻断 Claude Code 的正常执行。
}
