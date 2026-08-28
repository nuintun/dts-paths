/**
 * @module resolver
 */

import { TsConfig } from './types';
import { isString } from './shared';
import { resolve } from 'node:path';
import { ResolveResult, ResolverFactory } from 'oxc-resolver';

const EXTENSION_ALIAS = {
  '.js': ['.d.ts'],
  '.cjs': ['.d.cts'],
  '.mjs': ['.d.mts']
};

const EXTENSIONS = ['.d.ts', '.d.mts', '.d.cts'];

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
    extensions: EXTENSIONS,
    alias: compilerOptions?.paths,
    extensionAlias: EXTENSION_ALIAS,
    symlinks: !compilerOptions?.preserveSymlinks,
    roots: [compilerOptions?.rootDir ?? process.cwd()]
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
    extensions: EXTENSIONS,
    extensionAlias: EXTENSION_ALIAS,
    tsconfig: {
      references: 'auto',
      configFile: resolve(tsconfig)
    }
  });

  return (moduleName, containingFile) => {
    return resolver.resolveFileAsync(containingFile, moduleName);
  };
}
