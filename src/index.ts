/**
 * @module index
 */

import ts from 'typescript';
import { scanFiles } from './fs';
import MagicString from 'magic-string';
import { dirname, relative, resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

export interface Options {
  tsconfig?: string;
  exclude?(path: string): boolean;
}

const EXTENSION_MAP: Record<string, string> = {
  ts: '.js',
  tsx: '.js',
  js: '.js',
  jsx: '.js',
  cts: '.cjs',
  cjs: '.cjs',
  mts: '.mjs',
  mjs: '.mjs'
};

const EXT_RE = /\.(?:(?:d\.)?([cm]?tsx?)|([cm]?jsx?))$/i;

function toRelative(from: string, to: string) {
  let path = relative(dirname(from), to);

  path = path.replace(EXT_RE, (match, tsExt?: string, jsExt?: string) => {
    const ext = (tsExt || jsExt)?.toLowerCase();

    return ext ? EXTENSION_MAP[ext] || match : match;
  });

  if (!path.startsWith('.')) {
    path = `./${path}`;
  }

  return path.replace(/\\/g, '/');
}

function getCompilerOptions(tsconfig: string): ts.CompilerOptions {
  const configFile = ts.readConfigFile(tsconfig, ts.sys.readFile);

  if (configFile.error) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext([configFile.error], {
        getNewLine: () => '\n',
        getCanonicalFileName: name => name,
        getCurrentDirectory: ts.sys.getCurrentDirectory
      })
    );
  }

  return ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(tsconfig)).options;
}

function createModuleResolver(host: ts.ModuleResolutionHost, compilerOptions: ts.CompilerOptions) {
  const cache = new Map<string, ts.ResolvedModule | undefined>();

  return function resolveModule(moduleName: string, containingFile: string) {
    const key = `${containingFile}::${moduleName}`;

    if (cache.has(key)) {
      return cache.get(key);
    }

    const resolved = ts.resolveModuleName(
      moduleName,
      containingFile,
      compilerOptions,
      host
    ).resolvedModule;

    cache.set(key, resolved);

    return resolved;
  };
}

function transformFile(
  path: string,
  content: string,
  resolveModule: ReturnType<typeof createModuleResolver>
) {
  const source = new MagicString(content);
  const sourceFile = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);

  function updateSpecifier(specifier: ts.StringLiteral) {
    const moduleName = specifier.text;
    const resolved = resolveModule(moduleName, path);

    if (resolved && !resolved.isExternalLibraryImport) {
      const resolvedModuleName = toRelative(path, resolved.resolvedFileName);

      if (resolvedModuleName !== moduleName) {
        source.overwrite(
          specifier.getStart(sourceFile) + 1,
          specifier.getEnd() - 1,
          resolvedModuleName
        );
      }
    }
  }

  function visit(node: ts.Node) {
    let specifier: ts.StringLiteral | undefined;

    if (ts.isImportDeclaration(node)) {
      specifier = node.moduleSpecifier as ts.StringLiteral;
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      specifier = node.moduleSpecifier as ts.StringLiteral;
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      specifier = node.argument.literal as ts.StringLiteral;
    }

    if (specifier && ts.isStringLiteral(specifier)) {
      updateSpecifier(specifier);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return source;
}

async function rewriteSpecifiersInFile(
  path: string,
  resolveModule: ReturnType<typeof createModuleResolver>
) {
  const content = await readFile(path, 'utf8');
  const source = transformFile(path, content, resolveModule);

  if (source.hasChanged()) {
    await writeFile(path, source.toString());

    return true;
  }

  return false;
}

export async function resolvePaths(
  root: string,
  { tsconfig = 'tsconfig.json', exclude = () => false }: Options = {}
): Promise<Set<string>> {
  const changed = new Set<string>();
  const compilerOptions = getCompilerOptions(resolve(tsconfig));
  const resolveModule = createModuleResolver(ts.sys, compilerOptions);
  const files = scanFiles(root, path => path.endsWith('.d.ts') && !exclude(path));

  for await (const file of files) {
    if (await rewriteSpecifiersInFile(file, resolveModule)) {
      changed.add(file);
    }
  }

  return changed;
}
