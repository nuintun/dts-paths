import ts from 'typescript';
import { dirname, relative } from 'node:path';
import { Filter } from './fs';
import {
  MapExtension,
  MapExternal,
  OnResolveFailed,
  MapExternalContext
} from './types';

export const EXTENSION_MAP: Record<string, string> = {
  '.ts': '.js',
  '.jsx': '.js',
  '.tsx': '.js',
  '.cts': '.cjs',
  '.mts': '.mjs'
};

export const IMPORTER_EXT_RE = /\.[cm]?ts$/i;
export const MODULE_EXT_RE = /\.d?(\.(?:[tj]sx|[cm]?[tj]s))$/i;

export const DEFAULT_EXCLUDE: Filter = () => false;

export const DEFAULT_MAP_EXTERNAL: MapExternal = ({ name }: MapExternalContext) => name;

export const DEFAULT_MAP_EXTENSION: MapExtension = ({ extname, importer }) => {
  if (importer) {
    return EXTENSION_MAP[extname.toLowerCase()] ?? extname;
  }

  return extname;
};

export const DEFAULT_ON_RESOLVE_FAILED: OnResolveFailed = ({ name, importer }) => {
  throw new Error(`failed to resolve '${name}' from '${importer}'`);
};

export function isString(value: unknown): value is string {
  return Object.prototype.toString.call(value) === '[object String]';
}

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
