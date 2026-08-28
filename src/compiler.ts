/**
 * @module compiler
 */

import { TsConfig } from './types';
import { ResolverFactory } from 'oxc-resolver';
import { isAbsolute, resolve } from 'node:path';

/**
 * @typedef ResolvedModule
 * @description resolved module information
 */
export interface ResolvedModule {
  /**
   * @property resolvedFileName
   * @description the resolved module file path
   */
  resolvedFileName: string;
  /**
   * @property isExternalLibraryImport
   * @description whether the resolved module is an external library
   */
  isExternalLibraryImport: boolean;
}

/**
 * @typedef ResolveModule
 * @description resolves a module name to a resolved module
 * @param moduleName the module name to resolve
 * @param containingFile the file that contains the module reference
 */
export interface ResolveModule {
  (moduleName: string, containingFile: string): Promise<ResolvedModule | undefined>;
}

// regular expression to match node_modules path
const NODE_MODULES_RE = /(?:^|[\\/])node_modules(?:[\\/]|$)/;

/**
 * @function isExternalLibraryImport
 * @description checks whether a resolved path belongs to node_modules
 * @param path the resolved file path
 */
function isExternalLibraryImport(path: string): boolean {
  return NODE_MODULES_RE.test(path);
}

/**
 * @function resolveTsPath
 * @description resolves a tsconfig path target relative to the config directory
 * @param path the path target
 * @param basePath the config directory
 */
function resolveTsPath(path: string, basePath: string): string {
  if (isAbsolute(path)) {
    return resolve(path);
  }

  return resolve(basePath, path);
}

/**
 * @function createInlineResolver
 * @description creates a resolver for an inline tsconfig
 * @param tsconfig the inline tsconfig
 */
function createInlineResolver(tsconfig: TsConfig): ResolveModule {
  const basePath = process.cwd();
  const paths = tsconfig.compilerOptions?.paths ?? {};
  const symlinks = !(tsconfig.compilerOptions?.preserveSymlinks ?? false);

  const resolver = new ResolverFactory({
    symlinks
  });

  const aliases = Object.entries(paths).map(([key, targets]) => {
    const star = key.indexOf('*');

    return {
      prefix: star === -1 ? key : key.slice(0, star),
      suffix: star === -1 ? '' : key.slice(star + 1),
      targets: targets.map(target => {
        return {
          prefix: resolveTsPath(target.slice(0, Math.max(target.indexOf('*'), 0)), basePath),
          suffix: target.indexOf('*') === -1 ? '' : target.slice(target.indexOf('*') + 1),
          hasStar: target.includes('*')
        };
      })
    };
  });

  return async (moduleName, containingFile) => {
    for (const alias of aliases) {
      if (!moduleName.startsWith(alias.prefix) || !moduleName.endsWith(alias.suffix)) {
        continue;
      }

      const matched = moduleName.slice(alias.prefix.length, moduleName.length - alias.suffix.length);

      for (const target of alias.targets) {
        const request = target.hasStar ? `${target.prefix}${matched}${target.suffix}` : target.prefix;

        const result = await resolver.resolveDtsAsync(containingFile, request);

        if (result.path) {
          return {
            resolvedFileName: result.path,
            isExternalLibraryImport: isExternalLibraryImport(result.path)
          };
        }
      }
    }

    const result = await resolver.resolveDtsAsync(containingFile, moduleName);

    if (!result.path) {
      return undefined;
    }

    return {
      resolvedFileName: result.path,
      isExternalLibraryImport: isExternalLibraryImport(result.path)
    };
  };
}

/**
 * @function createModuleResolver
 * @description creates a module resolver
 * @param tsconfig typescript configuration path or inline configuration
 */
export function createModuleResolver(tsconfig: string | TsConfig): ResolveModule {
  if (typeof tsconfig !== 'string') {
    return createInlineResolver(tsconfig);
  }

  const resolver = new ResolverFactory({
    tsconfig: {
      configFile: resolve(tsconfig),
      references: 'auto'
    }
  });

  return async (moduleName, containingFile) => {
    const result = await resolver.resolveDtsAsync(containingFile, moduleName);

    if (!result.path) {
      return undefined;
    }

    return {
      resolvedFileName: result.path,
      isExternalLibraryImport: isExternalLibraryImport(result.path)
    };
  };
}
