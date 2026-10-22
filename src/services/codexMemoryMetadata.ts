import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { RuntimeTelemetry } from '../types/runtime';

type MemoryMetadata = NonNullable<RuntimeTelemetry['memoryMetadata']>;
type Options = { cwd?: string; home?: string; codexHome?: string };
export type CodexMemoryFile = { scope: 'global' | 'project'; name: string; content: string; truncated: boolean; updatedAt: string };
const MAX_MEMORY_FILES = 30;
const MAX_MEMORY_FILE_BYTES = 96 * 1024;

export function readCodexMemoryFiles({ cwd, home = os.homedir(), codexHome = process.env.CODEX_HOME || path.join(home, '.codex') }: Options): CodexMemoryFile[] {
  if (!path.isAbsolute(codexHome)) return [];
  const roots = [
    { scope: 'global' as const, path: path.join(codexHome, 'memories') },
    ...(cwd && path.isAbsolute(cwd) ? [{ scope: 'project' as const, path: path.join(cwd, '.codex', 'memories') }] : []),
  ];
  const files: CodexMemoryFile[] = [];
  for (const root of roots) {
    try {
      const rootStat = fs.lstatSync(root.path);
      if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) continue;
      for (const entry of fs.readdirSync(root.path, { withFileTypes: true })) {
        if (files.length >= MAX_MEMORY_FILES) return files;
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
        const file = path.join(root.path, entry.name);
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink()) continue;
        const buffer = Buffer.alloc(Math.min(stat.size, MAX_MEMORY_FILE_BYTES));
        const fd = fs.openSync(file, 'r');
        try { fs.readSync(fd, buffer, 0, buffer.length, 0); } finally { fs.closeSync(fd); }
        files.push({ scope: root.scope, name: entry.name, content: buffer.toString('utf8'), truncated: stat.size > MAX_MEMORY_FILE_BYTES, updatedAt: stat.mtime.toISOString() });
      }
    } catch { /* A missing or unreadable memory root contributes no file previews. */ }
  }
  return files;
}

export function readCodexMemoryMetadata({ cwd, home = os.homedir(), codexHome = process.env.CODEX_HOME || path.join(home, '.codex') }: Options): MemoryMetadata {
  const roots = [
    { scope: 'global' as const, path: path.join(codexHome, 'memories') },
    ...(cwd && path.isAbsolute(cwd) ? [{ scope: 'project' as const, path: path.join(cwd, '.codex', 'memories') }] : []),
  ];
  const totals = { globalFileCount: 0, projectFileCount: 0, globalBytes: 0, projectBytes: 0, latestMs: 0, found: 0 };

  try {
    if (!path.isAbsolute(codexHome)) throw new Error('Invalid memory path');
    for (const root of roots) {
      if (!fs.existsSync(root.path)) continue;
      const rootStat = fs.lstatSync(root.path);
      if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) continue;
      for (const entry of fs.readdirSync(root.path, { withFileTypes: true })) {
        const file = path.join(root.path, entry.name);
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink()) continue;
        totals.found++;
        if (root.scope === 'global') {
          totals.globalFileCount++;
          totals.globalBytes += stat.size;
        } else {
          totals.projectFileCount++;
          totals.projectBytes += stat.size;
        }
        totals.latestMs = Math.max(totals.latestMs, stat.mtimeMs);
      }
    }
    return {
      status: totals.found ? 'present' : 'missing',
      fileCount: totals.globalFileCount + totals.projectFileCount,
      totalBytes: totals.globalBytes + totals.projectBytes,
      latestModifiedAt: totals.latestMs ? new Date(totals.latestMs).toISOString() : null,
      globalFileCount: totals.globalFileCount,
      projectFileCount: totals.projectFileCount,
      globalBytes: totals.globalBytes,
      projectBytes: totals.projectBytes,
    };
  } catch {
    return { status: 'unavailable', fileCount: 0, totalBytes: 0, latestModifiedAt: null, globalFileCount: 0, projectFileCount: 0, globalBytes: 0, projectBytes: 0 };
  }
}
