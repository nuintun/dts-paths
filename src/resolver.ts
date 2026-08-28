/**
 * @module compiler
 */

import ts from 'typescript';

/**
 * @typedef ResolveModule
 * @description a function that resolves a module name to a resolved module
 * @param moduleName the module name to resolve
 * @param containingFile the file that contains the module reference
 */
export interface ResolveModule {
  (moduleName: string, containingFile: string): ts.ResolvedModuleFull | undefined;
}

/**
 * @function createModuleResolver
 * @description creates a module resolver function
 * @param host the typescript system host, typically `ts.sys`
 * @param compilerOptions compiler options to use for module resolution
 */
export function createModuleResolver(host: ts.System, compilerOptions: ts.CompilerOptions): ResolveModule {
  const cache = ts.createModuleResolutionCache(
    host.getCurrentDirectory(),
    filename => {
      if (host.useCaseSensitiveFileNames) {
        return filename;
      }

      return filename.toLowerCase();
    },
    compilerOptions
  );

  return function resolveModule(moduleName: string, containingFile: string) {
    const { resolvedModule } = ts.resolveModuleName(moduleName, containingFile, compilerOptions, host, cache);

    return resolvedModule;
  };
}
