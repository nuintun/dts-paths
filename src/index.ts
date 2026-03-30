/**
 * @module index
 */

import ts from 'typescript';
import { rename } from 'node:fs/promises';
import { scanFiles } from './fs';
import { createModuleResolver, getCompilerOptions } from './compiler';
import { rewriteSpecifiersInFile } from './rewriter';
import {
  DEFAULT_EXCLUDE,
  DEFAULT_MAP_EXTENSION,
  DEFAULT_MAP_EXTERNAL,
  DEFAULT_ON_RESOLVE_FAILED,
  IMPORTER_EXT_RE
} from './shared';
import { Options } from './types';

// Re-export types
export type {
  Filter,
  MapExternalContext,
  MapExtensionContext,
  OnResolveFailedContext,
  MapExternal,
  MapExtension,
  OnResolveFailed,
  TsConfig,
  Options
} from './types';

/**
 * @function resolvePaths
 * @description Main entry point - resolves and updates module paths in TypeScript declaration files
 * @param {string} root Root directory to scan for TypeScript files
 * @param {Options} [options] Configuration options object
 * @returns {Promise<Set<string>>} A Set containing file paths that were modified
 */
export async function resolvePaths(
  root: string,
  {
    exclude = DEFAULT_EXCLUDE,
    tsconfig = './tsconfig.json',
    mapExternal = DEFAULT_MAP_EXTERNAL,
    mapExtension = DEFAULT_MAP_EXTENSION,
    onResolveFailed = DEFAULT_ON_RESOLVE_FAILED
  }: Options = {}
): Promise<Set<string>> {
  const host = ts.sys;
  const importers: string[] = [];
  const changed = new Set<string>();
  const rewriteTasks: Promise<void>[] = [];
  const compilerOptions = getCompilerOptions(host, tsconfig);
  const resolveModule = createModuleResolver(host, compilerOptions);
  const files = scanFiles(root, path => IMPORTER_EXT_RE.test(path) && !exclude(path));

  for await (const file of files) {
    const rewriteTask = async () => {
      if (
        await rewriteSpecifiersInFile(
          file,
          resolveModule,
          mapExternal,
          mapExtension,
          onResolveFailed
        )
      ) {
        changed.add(file);
      }
    };

    importers.push(file);
    rewriteTasks.push(rewriteTask());
  }

  await Promise.all(rewriteTasks);

  await Promise.all(
    importers.map(async importer => {
      const path = importer.replace(IMPORTER_EXT_RE, extname => {
        return mapExtension({ path: importer, extname });
      });

      if (importer !== path) {
        await rename(importer, path);

        if (changed.delete(importer)) {
          changed.add(path);
        }
      }
    })
  );

  return changed;
}
