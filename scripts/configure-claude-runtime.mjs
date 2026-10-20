import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeClaudeRuntimeSettings } from '../src/services/claudeSettings.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const settingsPath = path.join(root, '.claude', 'settings.json');
const hookPath = path.join('.claude', 'hooks', 'claude-runtime-hook.mjs');
const hookPort = Number(process.env.AGENT_MATRIX_CLAUDE_HOOK_PORT) || 7788;
let settings = {};
if (fs.existsSync(settingsPath)) {
  try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
  catch { console.error(`未修改 ${settingsPath}：现有 JSON 无法解析。`); process.exitCode = 1; }
}
if (!process.exitCode) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(mergeClaudeRuntimeSettings(settings, hookPath, `http://127.0.0.1:${hookPort}/hook/claude`), null, 2)}\n`);
  console.log(`已安全合并 Claude runtime Hook：${settingsPath}`);
}
