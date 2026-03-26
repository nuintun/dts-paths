/**
 * @module tests/index
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { resolvePaths } from 'dts-paths';

const FIXTURE_TYPES = resolve('tests/types');
const SNAPSHOTS = resolve('tests/snapshots');

async function createWorkspace(prefix = 'dts-paths-test-') {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const types = join(root, 'types');

  await cp(FIXTURE_TYPES, types, { recursive: true });

  return { root, types };
}

function createTsconfig(root) {
  return {
    compilerOptions: {
      strict: true,
      moduleResolution: 'bundler',
      rootDir: root,
      paths: {
        '/*': [`${root}/*`]
      }
    }
  };
}

async function listDtsFiles(root) {
  const files = [];
  const waiting = [root];

  while (waiting.length > 0) {
    const current = waiting.pop();
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const path = join(current, entry.name);

      if (entry.isDirectory()) {
        waiting.push(path);
      } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
        files.push(path);
      }
    }
  }

  return files.sort();
}

test('rewrite result should match static snapshots', async t => {
  const { root, types } = await createWorkspace();

  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  await resolvePaths(types, { tsconfig: createTsconfig(types) });

  const snapshotFiles = await listDtsFiles(SNAPSHOTS);
  const typeFiles = await listDtsFiles(types);

  assert.equal(typeFiles.length, snapshotFiles.length);

  const snapshotMap = new Map(snapshotFiles.map(file => [relative(SNAPSHOTS, file), file]));

  for (const file of typeFiles) {
    const rel = relative(types, file);
    const snapshotFile = snapshotMap.get(rel);

    assert.ok(snapshotFile, `missing snapshot for ${rel}`);

    const [actual, expected] = await Promise.all([readFile(file, 'utf8'), readFile(snapshotFile, 'utf8')]);

    assert.equal(actual, expected, `rewritten content mismatch for ${rel}`);
  }
});

test('rewrite should be idempotent on copied types directory', async t => {
  const { root, types } = await createWorkspace('dts-paths-idempotent-');

  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const first = await resolvePaths(types, { tsconfig: createTsconfig(types) });
  const second = await resolvePaths(types, { tsconfig: createTsconfig(types) });

  assert.ok(first.size > 0);
  assert.equal(second.size, 0);
});
