import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { MarkdownCompatibleMemoryStore } from '../src/memory';

test('searches structured records and legacy markdown memory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'citadel-memory-'));
  await writeFile(path.join(root, 'MEMORY.md'), '# Lessons\nUse bounded retries for flaky APIs.\n', 'utf8');
  const memory = new MarkdownCompatibleMemoryStore(root);
  await memory.remember({
    id: 'one',
    namespace: 'learned-fixes',
    text: 'Fix TypeScript imports before rerunning the build.',
    source: 'test',
    metadata: {},
    createdAt: new Date().toISOString(),
  });
  const structured = await memory.search('TypeScript imports');
  const legacy = await memory.search('bounded retries');
  assert.equal(structured[0].id, 'one');
  assert.equal(legacy[0].namespace, 'legacy-markdown');
});
