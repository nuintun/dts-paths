/**
 * @module index
 */

import ts from 'typescript';
import { scanFiles } from './fs';
import MagicString from 'magic-string';
import { dirname, relative, resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

/**
 * @interface Options
 * @description Configuration options for path resolution
 */
export interface Options {
  /**
   * @description Path to TypeScript configuration file
   * @default 'tsconfig.json'
   */
  tsconfig?: string;
  /**
   * @description Function to exclude specific paths from processing
   * @param path File path to check
   * @returns true if the path should be excluded, false otherwise
   */
  exclude?(path: string): boolean;
}

/**
 * @constant EXTENSION_MAP
 * @description Maps TypeScript/JavaScript file extensions to their compiled output extensions
 */
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

/**
 * @constant EXT_RE
 * @description Regular expression to match TypeScript/JavaScript file extensions including declaration files
 */
const EXT_RE = /\.(?:(?:d\.)?([cm]?tsx?)|([cm]?jsx?))$/i;

/**
 * @function toRelative
 * @description Converts an absolute path to a relative import path with proper extension mapping
 * @param from The source file path
 * @param to The target file path
 * @returns Relative path with normalized separators and mapped extensions
 */
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

/**
 * @function getCompilerOptions
 * @description Reads and parses TypeScript compiler options from a tsconfig file
 * @param tsconfig Path to the tsconfig.json file
 * @returns Parsed TypeScript compiler options
 * @throws Error if the config file cannot be read or parsed
 */
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

/**
 * @function createModuleResolver
 * @description Creates a module resolution function with caching for improved performance
 * @param host TypeScript module resolution host
 * @param compilerOptions TypeScript compiler options
 * @returns A function that resolves module names to their file paths with caching
 */
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

/**
 * @function transformFile
 * @description Transforms a file's content by updating import/export specifiers to resolved paths
 * @param path The file path to transform
 * @param content The original file content
 * @param resolveModule Module resolution function
 * @returns A MagicString instance with transformed specifiers
 */
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

/**
 * @function rewriteSpecifiersInFile
 * @description Asynchronously rewrites import/export specifiers in a file and saves changes
 * @param path The file path to process
 * @param resolveModule Module resolution function
 * @returns true if the file was modified, false otherwise
 */
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

/**
 * @function resolvePaths
 * @description Resolves and updates module paths in TypeScript declaration files
 * @param root Root directory to scan for .d.ts files
 * @param options Configuration options including tsconfig path and exclude function
 * @returns A Set of file paths that were modified
 */
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
