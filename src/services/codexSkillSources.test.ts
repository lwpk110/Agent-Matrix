import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readCodexSkillSources } from './codexSkillSources';

test('reads project and global skill files with original content and frontmatter metadata', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-skill-sources-'));
  const project = path.join(root, 'project');
  const home = path.join(root, 'home');
  const projectFile = path.join(project, '.agents', 'skills', 'review', 'SKILL.md');
  const globalFile = path.join(home, '.codex', 'skills', 'review', 'SKILL.md');
  const pluginFile = path.join(home, '.codex', 'plugins', 'cache', 'sample-vendor', 'sample-plugin', '1.0.0', 'skills', 'review', 'SKILL.md');
  fs.mkdirSync(path.dirname(projectFile), { recursive: true });
  fs.mkdirSync(path.dirname(globalFile), { recursive: true });
  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  const projectContent = '---\nname: review\ndescription: Project review workflow\n---\nProject instructions.\n';
  const globalContent = '---\nname: review\nmetadata: global\n---\nGlobal instructions.\n';
  fs.writeFileSync(projectFile, projectContent);
  fs.writeFileSync(globalFile, globalContent);
  fs.writeFileSync(pluginFile, '---\nname: review\n---\nPlugin instructions.\n');

  try {
    const sources = readCodexSkillSources('review', project, home);
    assert.deepEqual(sources.map((source) => source.scope), ['project', 'global', 'global']);
    assert.equal(sources[0].path, projectFile);
    assert.equal(sources[0].content, projectContent);
    assert.equal(sources[0].metadata.description, 'Project review workflow');
    assert.equal(sources[1].metadata.metadata, 'global');
    assert.equal(sources[2].path, pluginFile);
    assert.ok(sources[0].modifiedAt);
    assert.equal(readCodexSkillSources('../outside', project, home).length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
