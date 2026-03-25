/**
 * @module index
 */

import ts from 'typescript';
import MagicString from 'magic-string';
import { Filter, scanFiles } from './fs';
import { dirname, relative, resolve } from 'node:path';
import { readFile, rename, writeFile } from 'node:fs/promises';

/**
 * @interface MapExtensionContext
 * @description Context object for mapping file extensions during module resolution
 */
export interface MapExtensionContext {
  /**
   * @property {string} path
   * @description The resolved file path being processed
   */
  path: string;
  /**
   * @property {string} extname
   * @description The file extension to map (e.g., '.ts', '.tsx')
   */
  extname: string;
  /**
   * @property {string} [importer]
   * @description Optional importer file path that references this module
   */
  importer?: string;
}

/**
 * @function MapExtension
 * @description Function type for mapping file extensions during module resolution
 * @param {MapExtensionContext} context The map extension context containing file information
 * @returns {string} The mapped file extension (e.g., '.ts' -> '.js')
 */
export interface MapExtension {
  (context: MapExtensionContext): string;
}

/**
 * @interface Options
 * @description Configuration options for path resolution
 */
export interface Options {
  /**
   * @property {Filter} [exclude]
   * @description Filter function used to exclude specific file paths from being processed
   * @param {string} path File path to check for exclusion
   * @returns {boolean} true if the path should be excluded, false otherwise
   */
  exclude?: Filter;
  /**
   * @property {string} [tsconfig='tsconfig.json']
   * @description Configuration file path for TypeScript compiler options
   * @default 'tsconfig.json'
   */
  tsconfig?: string;
  /**
   * @property {MapExtension} [mapExtension]
   * @description Function that maps TypeScript/JavaScript file extensions to their compiled output extensions
   */
  mapExtension?: MapExtension;
}

/**
 * @typedef {Function} ResolveModule
 * @description Module resolution function type definition with caching
 * @param {string} moduleName The module name to resolve (e.g., './utils/helper')
 * @param {string} containingFile The file path containing the module reference
 * @returns {ts.ResolvedModule | undefined} Resolved module information, or undefined if resolution fails
 */
type ResolveModule = ReturnType<typeof createModuleResolver>;

/**
 * @constant {Object<string, string>} EXTENSION_MAP
 * @description Maps TypeScript/JavaScript file extensions to their compiled output extensions
 */
const EXTENSION_MAP: Record<string, string> = {
  '.ts': '.js',
  '.jsx': '.js',
  '.tsx': '.js',
  '.cts': '.cjs',
  '.mts': '.mjs'
};

/**
 * @constant {RegExp} IMPORTER_EXT_RE
 * @description Regular expression matching TypeScript source file extensions (.ts, .cts, .mts)
 */
const IMPORTER_EXT_RE = /\.[cm]?ts$/i;

/**
 * @constant {RegExp} MODULE_EXT_RE
 * @description Regular expression matching TypeScript/JavaScript file extensions including declaration files
 */
const MODULE_EXT_RE = /\.d?(\.(?:[tj]sx|[cm]?[tj]s))$/i;

/**
 * @constant {Filter} DEFAULT_EXCLUDE
 * @description Default filter function that excludes no files (includes all files)
 */
const DEFAULT_EXCLUDE: Filter = () => false;

/**
 * @constant {MapExtension} DEFAULT_MAP_EXTENSION
 * @description Default extension mapping function that maps TypeScript extensions to JavaScript
 * @param {MapExtensionContext} context Mapping context containing file information
 * @param {string} context.extname Original file extension
 * @param {string} [context.importer] Importer file path (if resolving an import statement)
 * @returns {string} Mapped extension (e.g., '.ts' becomes '.js', or unchanged if no importer)
 */
const DEFAULT_MAP_EXTENSION: MapExtension = ({ extname, importer }) => {
  if (importer) {
    return EXTENSION_MAP[extname.toLowerCase()] ?? extname;
  }

  return extname;
};

/**
 * @function toRelative
 * @description Converts an absolute path to a relative import path with proper extension mapping
 * @param {string} from Source file path (the file containing the import statement)
 * @param {string} to Target file path (the file being imported)
 * @param {MapExtension} mapExtension Function to map file extensions
 * @returns {string} Relative import path from source to target with normalized separators and mapped extensions
 */
function toRelative(from: string, to: string, mapExtension: MapExtension) {
  // Get relative path from source file directory to target file
  let path = relative(dirname(from), to);

  // Replace TypeScript/JavaScript extensions with their compiled equivalents
  path = path.replace(MODULE_EXT_RE, (match, extname?: string) => {
    return extname ? mapExtension({ path: to, extname, importer: from }) : match;
  });

  // Ensure relative paths start with './'
  if (!path.startsWith('.')) {
    path = `./${path}`;
  }

  // Normalize path separators to forward slashes (cross-platform compatibility)
  return path.replace(/\\/g, '/');
}

/**
 * @function getCompilerOptions
 * @description Reads and parses TypeScript compiler options from a tsconfig file
 * @param {string} tsconfig Path to the tsconfig.json file
 * @returns {ts.CompilerOptions} Parsed TypeScript compiler options
 * @throws {Error} Throws error if the config file cannot be read or parsed
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
 * @param {ts.System} host TypeScript system interface providing file system operation capabilities
 * @param {ts.CompilerOptions} compilerOptions TypeScript compiler options affecting module resolution strategy
 * @returns {Function} A module resolution function with built-in caching mechanism
 */
function createModuleResolver(host: ts.System, compilerOptions: ts.CompilerOptions) {
  // Create module resolution cache
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
 * @param {string} path The file path to transform
 * @param {string} content The original file content
 * @param {MapExtension} mapExtension Function to map file extensions
 * @param {ResolveModule} resolveModule Module resolution function
 * @returns {MagicString} MagicString instance with transformed specifiers
 */
function transformFile(
  path: string,
  content: string,
  mapExtension: MapExtension,
  resolveModule: ResolveModule
) {
  // Create MagicString instance for efficient source code manipulation
  const source = new MagicString(content);
  // Parse source file into AST
  const sourceFile = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);

  /**
   * @function rewriteSpecifier
   * @description Updates a module specifier to its resolved relative path
   * @param {ts.StringLiteral} specifier The string literal node representing the module specifier
   */
  function rewriteSpecifier(specifier: ts.StringLiteral) {
    const moduleName = specifier.text;
    // Resolve the module name to its actual file path
    const resolved = resolveModule(moduleName, path);

    // Only update if resolved and not an external library import
    if (resolved && !resolved.isExternalLibraryImport) {
      const resolvedModuleName = toRelative(path, resolved.resolvedFileName, mapExtension);

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
   * @function visit
   * @description Recursively visits AST nodes to find module specifiers
   * @param {ts.Node} node The AST node to visit
   */
  function visit(node: ts.Node) {
    let specifier: ts.Node | undefined;

    // Handle import/export declarations: import ... from 'module' / export ... from 'module'
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
    }
    // Handle import type nodes: import('type')
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      specifier = node.argument.literal;
    }
    // Handle import equals declarations: import x = require('module')
    else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      specifier = node.moduleReference.expression;
    }

    // Update the specifier if found and is a string literal
    if (specifier && ts.isStringLiteral(specifier)) {
      rewriteSpecifier(specifier);
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
 * @param {string} path The file path to process
 * @param {MapExtension} mapExtension Function to map file extensions
 * @param {ResolveModule} resolveModule Module resolution function
 * @returns {Promise<boolean>} true if the file was modified, false otherwise
 */
async function rewriteSpecifiersInFile(
  path: string,
  mapExtension: MapExtension,
  resolveModule: ResolveModule
) {
  // Read file content
  const content = await readFile(path, 'utf8');
  // Transform the file content
  const source = transformFile(path, content, mapExtension, resolveModule);

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
 * @param {string} root Root directory to scan for TypeScript files
 * @param {Options} [options] Configuration options object
 * @param {Filter} [options.exclude=DEFAULT_EXCLUDE] Function to exclude specific paths from processing
 * @param {string} [options.tsconfig='tsconfig.json'] Path to TypeScript configuration file
 * @param {MapExtension} [options.mapExtension=DEFAULT_MAP_EXTENSION] Function to map file extensions during path resolution
 * @returns {Promise<Set<string>>} A Set containing file paths that were modified
 */
export async function resolvePaths(
  root: string,
  {
    exclude = DEFAULT_EXCLUDE,
    tsconfig = 'tsconfig.json',
    mapExtension = DEFAULT_MAP_EXTENSION
  }: Options = {}
): Promise<Set<string>> {
  // Collect all TypeScript files for extension mapping
  const importers: string[] = [];
  // Track changed files
  const changed = new Set<string>();
  // Stack of rewrite tasks
  const rewriteTasks: Promise<void>[] = [];
  // Load TypeScript compiler options from tsconfig
  const compilerOptions = getCompilerOptions(resolve(tsconfig));
  // Create module resolver with caching
  const resolveModule = createModuleResolver(ts.sys, compilerOptions);
  // Scan TypeScript-related files.
  const files = scanFiles(root, path => IMPORTER_EXT_RE.test(path) && !exclude(path));

  // Process each file asynchronously
  for await (const file of files) {
    /**
     * @function rewriteTask
     * @description Asynchronous rewrite task
     */
    const rewriteTask = async () => {
      // Rewrite specifiers and track if file was modified
      if (await rewriteSpecifiersInFile(file, mapExtension, resolveModule)) {
        changed.add(file);
      }
    };

    // Collect importers for extension mapping
    importers.push(file);

    // Create a rewrite task
    rewriteTasks.push(rewriteTask());
  }

  // Wait for all rewrite tasks to complete
  await Promise.all(rewriteTasks);

  // Rename files to match mapped extensions
  await Promise.all(
    importers.map(async importer => {
      const path = importer.replace(IMPORTER_EXT_RE, extname => {
        return mapExtension({ path: importer, extname });
      });

      if (importer !== path) {
        // Rename importer file
        await rename(importer, path);

        // Keep returned changed paths aligned with the renamed on-disk filename.
        // Only remap entries that were previously marked as changed by content rewrite.
        if (changed.delete(importer)) {
          changed.add(path);
        }
      }
    })
  );

  // Return the set of changed files
  return changed;
}
