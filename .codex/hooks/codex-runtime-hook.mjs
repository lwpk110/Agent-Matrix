import { stdin } from 'node:process';

const chunks = [];
for await (const chunk of stdin) chunks.push(chunk);

try {
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const endpoint = process.env.AGENT_MATRIX_CODEX_HOOK_URL || 'http://127.0.0.1:7789/hook/codex';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(1200),
  });
  await response.body?.cancel();
} catch {
  // Telemetry is best-effort and must never interrupt the Codex session.
}
