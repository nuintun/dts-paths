/**
 * @module rewriter
 */

import ts from 'typescript';
import { cpus } from 'node:os';
import { Filter } from './scanner';
import { dirname, relative, resolve } from 'node:path';
import { MapExtension, MapSpecifier, OnResolveFailed, TsConfig } from './types';

// extension mapping table
const EXTENSION_MAP: Record<string, string> = {
  '.ts': '.js',
  '.jsx': '.js',
  '.tsx': '.js',
  '.cts': '.cjs',
  '.mts': '.mjs'
};

// regular expression to scan declaration files
export const SCAN_DTS_RE = /\.d\.[cm]?ts$/i;

// regular expression to match module file extensions
export const IMPORTER_EXT_RE = /\.[cm]?ts$/i;

// regular expression to match module file extensions in import paths
export const MODULE_EXT_RE = /\.d?(\.(?:[tj]sx|[cm]?[tj]s))$/i;

// number of concurrent tasks to run, default to number of CPU cores
export const DEFAULT_CONCURRENCY = cpus().length;

// default filter function
export const DEFAULT_EXCLUDE: Filter = () => false;

// default specifier mapping function
export const DEFAULT_MAP_SPECIFIER: MapSpecifier = ({ specifier }) => {
  return specifier;
};

// default extension mapping function
export const DEFAULT_MAP_EXTENSION: MapExtension = ({ extname, importer }) => {
  if (importer) {
    return EXTENSION_MAP[extname.toLowerCase()] ?? extname;
  }

  return extname;
};

// default failed resolution handler
export const DEFAULT_ON_RESOLVE_FAILED: OnResolveFailed = ({ specifier, importer }) => {
  throw new Error(`failed to resolve '${specifier}' from '${importer}'`);
};

/**
 * @function isString
 * @description type guard to check if a value is a string
 * @param value the value to check
 */
export function isString(value: unknown): value is string {
  return Object.prototype.toString.call(value) === '[object String]';
}

/**
 * @function toRelative
 * @description converts a path to a relative path
 * @param from the source path
 * @param to the target path
 * @param mapExtension a function that maps file extensions based on the importer
 */
export function toRelative(from: string, to: string, mapExtension: MapExtension) {
  let path = relative(dirname(from), to);

  path = path.replace(MODULE_EXT_RE, (match, extname?: string) => {
    return extname ? mapExtension({ path: to, extname, importer: from }) : match;
  });

  if (!path.startsWith('.')) {
    path = `./${path}`;
  }

  return path.replace(/\\/g, '/');
}

/**
 * @function throwIfDiagnostics
 * @description throws an error if diagnostics are present
 * @param host the typescript system host, typically `ts.sys`
 * @param diagnostics the diagnostics to check
 */
export function throwIfDiagnostics(host: ts.System, diagnostics: readonly ts.Diagnostic[]): void {
  if (diagnostics.length > 0) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getNewLine: () => '\n',
        getCanonicalFileName: name => name,
        getCurrentDirectory: host.getCurrentDirectory
      })
    );
  }
}

/**
 * @function resolveCompilerOptions
 * @description loads and parses typescript compiler options
 * @param host the typescript system host, typically `ts.sys`
 * @param tsconfig path to tsconfig file or tsconfig object
 */
export function resolveCompilerOptions(host: ts.System, tsconfig: string | TsConfig): ts.CompilerOptions {
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
