/**
 * @module compiler
 */

import { dirname, isAbsolute, resolve } from 'node:path';
import { ResolverFactory } from 'oxc-resolver';
import { TsConfig } from './types';

/**
 * @typedef ResolveModule
 * @description resolves a module name to a resolved module
 * @param moduleName the module name to resolve
 * @param containingFile the file that contains the module reference
 */
export interface ResolveModule {
  (moduleName: string, containingFile: string): Promise<ResolvedModule | undefined>;
}

/**
 * @interface ResolvedModule
 * @description resolved module
 */
export interface ResolvedModule {
  /**
   * @property resolvedFileName
   * @description resolved file path
   */
  resolvedFileName: string;

  /**
   * @property isExternalLibraryImport
   * @description whether the module is an external library import
   */
  isExternalLibraryImport: boolean;
}

// regular expression to match node_modules path
const NODE_MODULES_RE = /(?:^|[\\/])node_modules(?:[\\/]|$)/;

// regular expression to match relative module specifier
const RELATIVE_SPECIFIER_RE = /^\.{1,2}(?:[\\/]|$)/;

// regular expression to match JavaScript module extensions
const MODULE_EXT_RE = /\.(?:js|mjs|cjs)$/i;

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
  return isAbsolute(path) ? resolve(path) : resolve(basePath, path);
}

/**
 * @interface TsPath
 * @description a TypeScript path mapping
 */
interface TsPath {
  prefix: string;
  suffix: string;
  targets: string[];
}

/**
 * @function createTsPaths
 * @description creates TypeScript path mappings
 * @param paths the TypeScript path mappings
 * @param basePath the tsconfig directory
 */
function createTsPaths(paths: Record<string, string[]>, basePath: string): TsPath[] {
  return Object.entries(paths)
    .map(([key, targets]) => {
      const star = key.indexOf('*');

      return {
        prefix: star === -1 ? key : key.slice(0, star),
        suffix: star === -1 ? '' : key.slice(star + 1),
        targets: targets.map(target => {
          return resolveTsPath(target, basePath);
        })
      };
    })
    .sort((a, b) => {
      return b.prefix.length - a.prefix.length;
    });
}

/**
 * @function matchTsPath
 * @description matches a module specifier against a TypeScript path mapping
 * @param path the TypeScript path mapping
 * @param specifier the module specifier
 */
function matchTsPath(path: TsPath, specifier: string): string[] | undefined {
  if (!specifier.startsWith(path.prefix) || !specifier.endsWith(path.suffix)) {
    return undefined;
  }

  const start = path.prefix.length;
  const end = specifier.length - path.suffix.length;
  const matched = specifier.slice(start, end);

  return path.targets.map(target => {
    return target.replace(/\*/g, matched);
  });
}

/**
 * @function stripModuleExtension
 * @description removes a JavaScript module extension from a relative specifier
 * @param specifier the module specifier
 */
function stripModuleExtension(specifier: string): string {
  return specifier.replace(MODULE_EXT_RE, '');
}

/**
 * @function toResolvedModule
 * @description converts a resolver result to a resolved module
 * @param path the resolved file path
 */
function toResolvedModule(path: string): ResolvedModule {
  return {
    resolvedFileName: path,
    isExternalLibraryImport: isExternalLibraryImport(path)
  };
}

/**
 * @function resolveDeclaration
 * @description resolves a declaration module specifier
 * @param resolver the resolver
 * @param moduleName the module name
 * @param containingFile the file that contains the module reference
 */
async function resolveDeclaration(resolver: ResolverFactory, moduleName: string, containingFile: string) {
  let result = await resolver.resolveFileAsync(containingFile, moduleName);

  if (!result.path && RELATIVE_SPECIFIER_RE.test(moduleName) && MODULE_EXT_RE.test(moduleName)) {
    result = await resolver.resolveDtsAsync(containingFile, stripModuleExtension(moduleName));
  }

  return result;
}

/**
 * @function createResolver
 * @description creates an Oxc resolver
 * @param preserveSymlinks whether to preserve symbolic links
 */
function createResolver(preserveSymlinks: boolean): ResolverFactory {
  return new ResolverFactory({
    symlinks: !preserveSymlinks,
    extensions: ['.d.ts', '.d.mts', '.d.cts']
  });
}

/**
 * @function createInlineResolver
 * @description creates a resolver for an inline tsconfig
 * @param tsconfig the inline tsconfig
 */
function createInlineResolver(tsconfig: TsConfig): ResolveModule {
  const basePath = process.cwd();
  const paths = createTsPaths(tsconfig.compilerOptions?.paths ?? {}, basePath);
  const resolver = createResolver(tsconfig.compilerOptions?.preserveSymlinks ?? false);

  return async (moduleName, containingFile) => {
    for (const path of paths) {
      const matched = matchTsPath(path, moduleName);

      if (!matched) {
        continue;
      }

      for (const request of matched) {
        const result = await resolver.async(dirname(containingFile), request);

        if (result.path) {
          return toResolvedModule(result.path);
        }
      }
    }

    const result = await resolveDeclaration(resolver, moduleName, containingFile);

    return result.path ? toResolvedModule(result.path) : undefined;
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
      references: 'auto',
      configFile: resolve(tsconfig)
    },
    extensions: ['.d.ts', '.d.mts', '.d.cts']
  });

  return async (moduleName, containingFile) => {
    const result = await resolveDeclaration(resolver, moduleName, containingFile);

    return result.path ? toResolvedModule(result.path) : undefined;
  };
}
