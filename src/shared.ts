/**
 * @module rewriter
 */

import ts from 'typescript';
import { Filter } from './fs';
import { dirname, relative } from 'node:path';
import { MapExtension, MapSpecifier, OnResolveFailed } from './types';

// Extension mapping table
const EXTENSION_MAP: Record<string, string> = {
  '.ts': '.js',
  '.jsx': '.js',
  '.tsx': '.js',
  '.cts': '.cjs',
  '.mts': '.mjs'
};

// Regular expression to match module file extensions
export const IMPORTER_EXT_RE = /\.[cm]?ts$/i;

// Regular expression to match module file extensions in import paths
export const MODULE_EXT_RE = /\.d?(\.(?:[tj]sx|[cm]?[tj]s))$/i;

// Default filter function
export const DEFAULT_EXCLUDE: Filter = () => false;

// Default specifier mapping function
export const DEFAULT_MAP_SPECIFIER: MapSpecifier = ({ name }) => {
  return name;
};

// Default extension mapping function
export const DEFAULT_MAP_EXTENSION: MapExtension = ({ extname, importer }) => {
  if (importer) {
    return EXTENSION_MAP[extname.toLowerCase()] ?? extname;
  }

  return extname;
};

// Default failed resolution handler
export const DEFAULT_ON_RESOLVE_FAILED: OnResolveFailed = ({ name, importer }) => {
  throw new Error(`failed to resolve '${name}' from '${importer}'`);
};

/**
 * @function isString
 * @description Type guard to check if a value is a string
 * @param value The value to check
 */
export function isString(value: unknown): value is string {
  return Object.prototype.toString.call(value) === '[object String]';
}

/**
 * @function throwIfDiagnostics
 * @description Throws an error if diagnostics are present
 * @param host The TypeScript system host, typically `ts.sys`
 * @param diagnostics The diagnostics to check
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
 * @function toRelative
 * @description Converts a path to a relative path
 * @param from The source path
 * @param to The target path
 * @param mapExtension A function that maps file extensions based on the importer
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
