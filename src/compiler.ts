/**
 * @module compiler
 */

import ts from 'typescript';
import { TsConfig } from './types';
import { dirname, resolve } from 'node:path';
import { isString, throwIfDiagnostics } from './shared';

/**
 * @function getCompilerOptions
 * @description Loads and parses TypeScript compiler options from a tsconfig file or TsConfig object
 * @param host The TypeScript system host, typically `ts.sys`
 * @param tsconfig Path to tsconfig file or TsConfig object
 */
export function getCompilerOptions(
  host: ts.System,
  tsconfig: string | TsConfig
): ts.CompilerOptions {
  let config: TsConfig;
  let basePath: string;

  if (isString(tsconfig)) {
    const path = resolve(tsconfig);
    const configFile = ts.readConfigFile(path, host.readFile);

    if (configFile.error) {
      throwIfDiagnostics(host, [configFile.error]);
    }

    basePath = dirname(path);
    config = configFile.config;
  } else {
    config = tsconfig;
    basePath = host.getCurrentDirectory();
  }

  const { options, errors } = ts.parseJsonConfigFileContent(config, host, basePath);

  throwIfDiagnostics(host, errors);

  options.declaration = false;

  return options;
}

/**
 * @typedef ResolveModule
 * @description A function that resolves a module name to a resolved module
 * @param moduleName The module name to resolve
 * @param containingFile The file that contains the module reference
 */
export interface ResolveModule {
  (moduleName: string, containingFile: string): ts.ResolvedModuleFull | undefined;
}

/**
 * @function createModuleResolver
 * @description Creates a module resolver function
 * @param host The TypeScript system host, typically `ts.sys`
 * @param compilerOptions Compiler options to use for module resolution
 */
export function createModuleResolver(
  host: ts.System,
  compilerOptions: ts.CompilerOptions
): ResolveModule {
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
    const { resolvedModule } = ts.resolveModuleName(
      moduleName,
      containingFile,
      compilerOptions,
      host,
      cache
    );

    return resolvedModule;
  };
}
