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
  // Get relative path from source file directory to target file
  let path = relative(dirname(from), to);

  // Replace TypeScript/JavaScript extensions with their compiled equivalents
  path = path.replace(EXT_RE, (match, tsExt?: string, jsExt?: string) => {
    const ext = (tsExt || jsExt)?.toLowerCase();

    return ext ? EXTENSION_MAP[ext] || match : match;
  });

  // Ensure relative paths start with './'
  if (!path.startsWith('.')) {
    path = `./${path}`;
  }

  // Normalize path separators to forward slashes
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
  // Read and parse tsconfig.json file
  const configFile = ts.readConfigFile(tsconfig, ts.sys.readFile);

  // Throw error if config file cannot be read
  if (configFile.error) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext([configFile.error], {
        getNewLine: () => '\n',
        getCanonicalFileName: name => name,
        getCurrentDirectory: ts.sys.getCurrentDirectory
      })
    );
  }

  // Parse config file content and extract compiler options
  return ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(tsconfig)).options;
}

/**
 * @function createModuleResolver
 * @description Creates a module resolution function with caching for improved performance
 * @returns A function that resolves module names to their file paths with caching
 */
function createModuleResolver(host: ts.System, compilerOptions: ts.CompilerOptions) {
  const cache = ts.createModuleResolutionCache(
    host.getCurrentDirectory(),
    filename => filename,
    compilerOptions
  );

  // Return resolver function with closure over the cache
  return function resolveModule(moduleName: string, containingFile: string) {
    // Resolve module using TypeScript's module resolution
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
  // Create MagicString instance for efficient source code manipulation
  const source = new MagicString(content);
  // Parse source file into AST
  const sourceFile = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);

  /**
   * Updates a module specifier to its resolved relative path
   */
  function updateSpecifier(specifier: ts.StringLiteral) {
    const moduleName = specifier.text;
    // Resolve the module name to its actual file path
    const resolved = resolveModule(moduleName, path);

    // Only update if resolved and not an external library import
    if (resolved && !resolved.isExternalLibraryImport) {
      const resolvedModuleName = toRelative(path, resolved.resolvedFileName);

      // Replace the specifier text if the resolved path is different
      if (resolvedModuleName !== moduleName) {
        source.overwrite(
          specifier.getStart(sourceFile) + 1,
          specifier.getEnd() - 1,
          resolvedModuleName
        );
      }
    }
  }

  /**
   * Recursively visits AST nodes to find module specifiers
   */
  function visit(node: ts.Node) {
    let specifier: ts.Node | undefined;

    // Handle import declarations: import ... from 'module'
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
    }
    // Handle import type nodes: import('type').Type
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      specifier = node.argument.literal;
    }

    // Update the specifier if found and is a string literal
    if (specifier && ts.isStringLiteral(specifier)) {
      updateSpecifier(specifier);
    }

    // Continue traversing child nodes
    ts.forEachChild(node, visit);
  }

  // Start AST traversal from the root
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
  // Read file content
  const content = await readFile(path, 'utf8');
  // Transform the file content
  const source = transformFile(path, content, resolveModule);

  // Write back only if changes were made
  if (source.hasChanged()) {
    await writeFile(path, source.toString());

    return true;
  }

  return false;
}

/**
 * @function resolvePaths
 * @description Main entry point - resolves and updates module paths in TypeScript declaration files
 * @param root Root directory to scan for .d.ts files
 * @param options Configuration options including tsconfig path and exclude function
 * @returns A Set of file paths that were modified
 */
export async function resolvePaths(
  root: string,
  { tsconfig = 'tsconfig.json', exclude = () => false }: Options = {}
): Promise<Set<string>> {
  // Track changed files
  const changed = new Set<string>();
  // Load TypeScript compiler options from tsconfig
  const compilerOptions = getCompilerOptions(resolve(tsconfig));
  // Create module resolver with caching
  const resolveModule = createModuleResolver(ts.sys, compilerOptions);
  // Scan for .d.ts files, applying exclude filter
  const files = scanFiles(root, path => path.endsWith('.d.ts') && !exclude(path));

  // Process each file asynchronously
  for await (const file of files) {
    // Rewrite specifiers and track if file was modified
    if (await rewriteSpecifiersInFile(file, resolveModule)) {
      changed.add(file);
    }
  }

  return changed;
}
