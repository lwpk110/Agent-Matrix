import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type CodexSkillSource = {
  scope: 'project' | 'global';
  root: string;
  path: string;
  modifiedAt: string;
  sizeBytes: number;
  metadata: Record<string, string>;
  rawMetadata: string;
  content: string;
};

const MAX_SKILL_BYTES = 256 * 1024;

function frontmatter(content: string) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { rawMetadata: '', metadata: {} as Record<string, string> };
  const metadata: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([\w.-]+):\s*(.*?)\s*$/);
    if (field) metadata[field[1]] = field[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return { rawMetadata: match[1], metadata };
}

function safeName(name: string) {
  return /^[\w.-]+(?::[\w.-]+){0,2}$/.test(name) && name.length <= 120 && !name.split(':').includes('..');
}

function inside(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function readCodexSkillSources(name: string, projectCwd: string, homeDir = os.homedir()): CodexSkillSource[] {
  if (!safeName(name)) return [];
  const projectRoot = path.resolve(projectCwd);
  const globalRoots = [...new Set([
    process.env.CODEX_HOME ? path.join(process.env.CODEX_HOME, 'skills') : '',
    path.join(homeDir, '.agents', 'skills'),
    path.join(homeDir, '.codex', 'skills'),
    path.join(homeDir, '.claude', 'skills'),
  ].filter(Boolean).map((root) => path.resolve(root)))];
  const candidates = [
    ...['.agents', '.codex', '.claude'].map((directory) => ({ scope: 'project' as const, root: path.join(projectRoot, directory, 'skills') })),
    ...globalRoots.map((root) => ({ scope: 'global' as const, root })),
  ];
  const pluginCache = path.join(homeDir, '.codex', 'plugins', 'cache');
  try {
    const pending = [{ root: pluginCache, depth: 0 }];
    while (pending.length) {
      const current = pending.pop()!;
      if (current.depth >= 4) continue;
      for (const directory of fs.readdirSync(current.root, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
        const root = path.join(current.root, directory.name);
        if (directory.name.toLocaleLowerCase() === 'skills') candidates.push({ scope: 'global', root });
        else pending.push({ root, depth: current.depth + 1 });
      }
    }
  } catch {
    // Plugin cache is optional; standard skill roots are still checked.
  }
  const results: CodexSkillSource[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    try {
      const realRoot = fs.realpathSync(candidate.root);
      for (const directory of fs.readdirSync(realRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
        let realFile: string;
        try { realFile = fs.realpathSync(path.join(realRoot, directory.name, 'SKILL.md')); } catch { continue; }
        if (!inside(realRoot, realFile) || seen.has(realFile) || !fs.statSync(realFile).isFile()) continue;
        const stat = fs.statSync(realFile);
        if (stat.size > MAX_SKILL_BYTES) continue;
        const content = fs.readFileSync(realFile, 'utf8');
        const parsed = frontmatter(content);
        const declaredName = parsed.metadata.name?.trim().toLocaleLowerCase() || '';
        const matchesName = directory.name.toLocaleLowerCase() === name.toLocaleLowerCase()
          || declaredName === name.toLocaleLowerCase()
          || declaredName.split(':').at(-1) === name.toLocaleLowerCase();
        if (!matchesName) continue;
        results.push({
          scope: candidate.scope,
          root: realRoot,
          path: realFile,
          modifiedAt: stat.mtime.toISOString(),
          sizeBytes: Buffer.byteLength(content, 'utf8'),
          ...parsed,
          content,
        });
        seen.add(realFile);
      }
    } catch {
      // A missing or unreadable candidate does not hide other matching sources.
    }
  }
  return results;
}
