/**
 * @module resolver
 */

import { TsConfig } from './types';
import { isString } from './shared';
import { resolve } from 'node:path';
import { ResolveResult, ResolverFactory } from 'oxc-resolver';

/**
 * @typedef ResolveModule
 * @description resolves a module name to a resolved module
 * @param moduleName the module name to resolve
 * @param containingFile the file that contains the module reference
 */
export interface ResolveModule {
  (moduleName: string, containingFile: string): Promise<ResolveResult>;
}

/**
 * @function createInlineResolver
 * @description creates a resolver for an inline tsconfig
 * @param tsconfig the inline tsconfig
 */
function createInlineResolver({ compilerOptions }: TsConfig): ResolveModule {
  const resolver = new ResolverFactory({
    extensionAlias: {
      '.js': ['.d.ts'],
      '.cjs': ['.d.cts'],
      '.mjs': ['.d.mts']
    },
    alias: compilerOptions?.paths,
    extensions: ['.d.ts', '.d.mts', '.d.cts'],
    roots: [compilerOptions?.rootDir ?? process.cwd()],
    symlinks: compilerOptions?.preserveSymlinks ?? false
  });

  return (moduleName, containingFile) => {
    return resolver.resolveFileAsync(containingFile, moduleName);
  };
}

/**
 * @function createModuleResolver
 * @description creates a module resolver
 * @param tsconfig typescript configuration path or inline configuration
 */
export function createModuleResolver(tsconfig: string | TsConfig): ResolveModule {
  if (!isString(tsconfig)) {
    return createInlineResolver(tsconfig);
  }

  const resolver = new ResolverFactory({
    extensionAlias: {
      '.js': ['.d.ts'],
      '.cjs': ['.d.cts'],
      '.mjs': ['.d.mts']
    },
    tsconfig: {
      references: 'auto',
      configFile: resolve(tsconfig)
    },
    extensions: ['.d.ts', '.d.mts', '.d.cts']
  });

  return (moduleName, containingFile) => {
    return resolver.resolveFileAsync(containingFile, moduleName);
  };
}
