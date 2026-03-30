import ts from 'typescript';
import { dirname, resolve } from 'node:path';
import { TsConfig } from './types';
import { isString, throwIfDiagnostics } from './shared';

export function getCompilerOptions(host: ts.System, tsconfig: string | TsConfig): ts.CompilerOptions {
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

export type ResolveModule = (moduleName: string, containingFile: string) =>
  | ts.ResolvedModuleFull
  | undefined;

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
