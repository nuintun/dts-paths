/**
 * @module index
 */

import {
  DEFAULT_EXCLUDE,
  DEFAULT_MAP_EXTENSION,
  DEFAULT_MAP_SPECIFIER,
  DEFAULT_ON_RESOLVE_FAILED,
  IMPORTER_EXT_RE,
  SCAN_DTS_RE
} from './shared';
import ts from 'typescript';
import { scanFiles } from './fs';
import { Options } from './types';
import { rename } from 'node:fs/promises';
import { rewriteSpecifiersInFile } from './rewriter';
import { createModuleResolver, getCompilerOptions } from './compiler';

export type {
  MapExtension,
  MapExtensionContext,
  MapSpecifier,
  MapSpecifierContext,
  OnResolveFailed,
  OnResolveFailedContext,
  Options,
  TsConfig
} from './types';
export type { Filter } from './fs';

/**
 * @function resolvePaths
 * @param root The root directory to scan for TypeScript files
 * @param options The options for resolving paths
 */
export async function resolvePaths(
  root: string,
  {
    exclude = DEFAULT_EXCLUDE,
    tsconfig = './tsconfig.json',
    mapSpecifier = DEFAULT_MAP_SPECIFIER,
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
  const files = scanFiles(root, path => SCAN_DTS_RE.test(path) && !exclude(path));

  for await (const file of files) {
    const rewriteTask = async () => {
      if (
        await rewriteSpecifiersInFile(
          file,
          mapSpecifier,
          resolveModule,
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
