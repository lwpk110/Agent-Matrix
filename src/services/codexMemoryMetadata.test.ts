import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readCodexMemoryFiles, readCodexMemoryMetadata } from './codexMemoryMetadata';

test('aggregates global and current-project memory file metadata without reading contents', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-memory-'));
  const home = path.join(root, 'home');
  const codexHome = path.join(home, '.codex');
  const cwd = path.join(root, 'project');
  await fs.mkdir(path.join(codexHome, 'memories'), { recursive: true });
  await fs.mkdir(path.join(cwd, '.codex', 'memories'), { recursive: true });
  await fs.writeFile(path.join(codexHome, 'memories', 'MEMORY.md'), 'global secret text');
  await fs.writeFile(path.join(cwd, '.codex', 'memories', 'project.md'), 'project secret text');
  try {
    const metadata = readCodexMemoryMetadata({ cwd, home, codexHome });
    assert.equal(metadata.status, 'present');
    assert.equal(metadata.fileCount, 2);
    assert.equal(metadata.globalFileCount, 1);
    assert.equal(metadata.projectFileCount, 1);
    assert.equal(metadata.totalBytes, Buffer.byteLength('global secret textproject secret text'));
    assert.equal(metadata.globalBytes, Buffer.byteLength('global secret text'));
    assert.equal(metadata.projectBytes, Buffer.byteLength('project secret text'));
    assert.doesNotMatch(JSON.stringify(metadata), /secret text|MEMORY\.md|project\.md/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('returns global and project Markdown previews with names and scope only', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-memory-preview-'));
  const codexHome = path.join(root, '.codex');
  const cwd = path.join(root, 'project');
  await fs.mkdir(path.join(codexHome, 'memories'), { recursive: true });
  await fs.mkdir(path.join(cwd, '.codex', 'memories'), { recursive: true });
  await fs.writeFile(path.join(codexHome, 'memories', 'MEMORY.md'), '# Global note');
  await fs.writeFile(path.join(cwd, '.codex', 'memories', 'project.md'), '# Project note');
  try {
    const files = readCodexMemoryFiles({ codexHome, cwd });
    assert.deepEqual(files.map(({ scope, name, content, truncated }) => ({ scope, name, content, truncated })), [
      { scope: 'global', name: 'MEMORY.md', content: '# Global note', truncated: false },
      { scope: 'project', name: 'project.md', content: '# Project note', truncated: false },
    ]);
    assert.ok(files.every(file => Number.isFinite(Date.parse(file.updatedAt))));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('collects global memory metadata when the session has no project cwd', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-global-memory-'));
  const codexHome = path.join(root, '.codex');
  await fs.mkdir(path.join(codexHome, 'memories'), { recursive: true });
  await fs.writeFile(path.join(codexHome, 'memories', 'MEMORY.md'), 'global');
  try {
    const metadata = readCodexMemoryMetadata({ codexHome });
    assert.equal(metadata.status, 'present');
    assert.equal(metadata.fileCount, 1);
    assert.equal(metadata.globalFileCount, 1);
    assert.equal(metadata.projectFileCount, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
