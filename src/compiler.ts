/**
 * @module compiler
 */

import ts from 'typescript';
import { TsConfig } from './types';
import { dirname, resolve } from 'node:path';
import { isString, throwIfDiagnostics } from './shared';

/**
 * @function getCompilerOptions
 * @description loads and parses typescript compiler options
 * @param host the typescript system host, typically `ts.sys`
 * @param tsconfig path to tsconfig file or tsconfig object
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
    const { compilerOptions = {} } = tsconfig;

    basePath = host.getCurrentDirectory();
    config = {
      extends: tsconfig.extends,
      compilerOptions: {
        paths: compilerOptions.paths,
        rootDir: compilerOptions.rootDir,
        preserveSymlinks: compilerOptions.preserveSymlinks
      }
    };
  }

  const { options, errors } = ts.parseJsonConfigFileContent(config, host, basePath);

  throwIfDiagnostics(host, errors);

  options.declaration = false;

  return options;
}

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
