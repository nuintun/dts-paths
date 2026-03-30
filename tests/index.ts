/**
 * @module index
 */

import test from 'node:test';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { resolvePaths } from 'dts-paths';
import { join, relative, resolve } from 'node:path';
import type { OnResolveFailedContext } from 'dts-paths';
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';

interface Workspace {
  dts: string;
  root: string;
}

interface TsConfig {
  compilerOptions: {
    strict: boolean;
    rootDir: string;
    paths: Record<string, string[]>;
    moduleResolution: 'bundler' | 'node' | 'classic';
  };
}

const DTS_RE = /\.d\.ts$/i;
const FIXTURE_DTS = resolve('tests/dts');
const SNAPSHOTS = resolve('tests/snapshots');

function createTsConfig(root: string): TsConfig {
  return {
    compilerOptions: {
      strict: true,
      rootDir: root,
      moduleResolution: 'bundler',
      paths: {
        '/*': [`${root}/*`]
      }
    }
  };
}

async function scanDtsFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const waiting: string[] = [root];

  let current: string | undefined;

  while ((current = waiting.pop())) {
    for (const entry of await readdir(current, {
      withFileTypes: true
    })) {
      const path = join(current, entry.name);

      if (entry.isDirectory()) {
        waiting.push(path);
      } else if (entry.isFile() && DTS_RE.test(entry.name)) {
        files.push(path);
      }
    }
  }

  return files;
}

async function createWorkspace(prefix = 'dts-paths-test-'): Promise<Workspace> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const dts = join(root, 'dts');

  await cp(FIXTURE_DTS, dts, {
    recursive: true
  });

  return { dts, root };
}

test('rewrite result should match static snapshots', async test => {
  const { dts, root } = await createWorkspace();

  test.after(async () => {
    await rm(root, {
      force: true,
      recursive: true
    });
  });

  await resolvePaths(dts, {
    tsconfig: createTsConfig(dts)
  });

  const dtsFiles = await scanDtsFiles(dts);
  const snapshotFiles = await scanDtsFiles(SNAPSHOTS);

  assert.equal(dtsFiles.length, snapshotFiles.length);

  const snapshotMap = new Map<string, string>(
    snapshotFiles.map(file => [relative(SNAPSHOTS, file), file])
  );

  for (const file of dtsFiles) {
    const path = relative(dts, file);
    const snapshotFile = snapshotMap.get(path);

    assert.ok(snapshotFile, `missing snapshot for ${path}`);

    const [actual, expected] = await Promise.all([
      readFile(file, 'utf8'),
      readFile(snapshotFile, 'utf8')
    ]);

    assert.equal(actual, expected, `rewritten content mismatch for ${path}`);
  }
});

test('rewrite should be idempotent on copied dts directory', async test => {
  const { dts, root } = await createWorkspace('dts-paths-idempotent-');

  test.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const first = await resolvePaths(dts, {
    tsconfig: createTsConfig(dts)
  });
  const second = await resolvePaths(dts, {
    tsconfig: createTsConfig(dts)
  });

  assert.ok(first.size > 0);
  assert.equal(second.size, 0);
});

test('onResolveFailed should be called for unresolved module specifiers', async test => {
  const { dts, root } = await createWorkspace('dts-paths-on-resolve-failed-');

  test.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const unresolvedSpecifier = './missing';
  const failed: OnResolveFailedContext[] = [];
  const unresolvedImporter = join(dts, 'unresolved.d.ts');

  await writeFile(unresolvedImporter, `export * from '${unresolvedSpecifier}';\n`);

  await resolvePaths(dts, {
    tsconfig: createTsConfig(dts),
    onResolveFailed: context => {
      failed.push(context);
    }
  });

  assert.deepEqual(failed, [
    {
      specifier: unresolvedSpecifier,
      importer: unresolvedImporter
    }
  ]);
});
