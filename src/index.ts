/**
 * @module index
 */

import {
  CPUS,
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
import scheduleTasks from 'p-limit';
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
 * @param root the root directory to scan for typescript files
 * @param options the options for resolving paths
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
  const schedule = scheduleTasks(CPUS);
  const rewriteTasks: Promise<void>[] = [];
  const compilerOptions = getCompilerOptions(host, tsconfig);
  const resolveModule = createModuleResolver(host, compilerOptions);
  const files = scanFiles(root, path => SCAN_DTS_RE.test(path) && !exclude(path));

  for await (const file of files) {
    // collect importers
    importers.push(file);

    // rewrite specifiers in parallel
    rewriteTasks.push(
      schedule(async () => {
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
      })
    );
  }

  // wait for all rewrite tasks to complete
  await Promise.all(rewriteTasks);

  // wait for all importer renaming tasks to complete
  await Promise.all(
    importers.map(importer => {
      return schedule(async () => {
        const path = importer.replace(IMPORTER_EXT_RE, extname => {
          return mapExtension({ path: importer, extname });
        });

        if (path !== importer) {
          await rename(importer, path);

          if (changed.delete(importer)) {
            changed.add(path);
          }
        }
      });
    })
  );

  return changed;
}
