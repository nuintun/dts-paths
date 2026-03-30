/**
 * @module rewriter
 */

import ts from 'typescript';
import { toRelative } from './shared';
import MagicString from 'magic-string';
import { ResolveModule } from './compiler';
import { readFile, writeFile } from 'node:fs/promises';
import { MapExtension, MapSpecifier, OnResolveFailed } from './types';

/**
 * @function transformFile
 * @description Transforms a TypeScript file by rewriting its module specifiers
 * @param path The file path of the TypeScript file to transform
 * @param content The content of the TypeScript file
 * @param resolveModule A function that resolves module names to resolved modules
 * @param mapSpecifier A function that maps module specifiers
 * @param mapExtension A function that maps file extensions based on the importer
 * @param onResolveFailed A callback function that is called when module resolution fails
 */
function transformFile(
  path: string,
  content: string,
  resolveModule: ResolveModule,
  mapSpecifier: MapSpecifier,
  mapExtension: MapExtension,
  onResolveFailed: OnResolveFailed
) {
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const source = new MagicString(content);

  /**
   * @function rewriteSpecifier
   * @description Rewrites a module specifier if it can be resolved
   * @param specifier The string literal representing the module specifier
   */
  function rewriteSpecifier(specifier: ts.StringLiteral) {
    const moduleName = specifier.text;
    const mappedModuleName = mapSpecifier({ name: moduleName, importer: path });
    const resolved = resolveModule(mappedModuleName, path);

    if (resolved) {
      let resolvedModuleName: string;

      if (resolved.isExternalLibraryImport) {
        resolvedModuleName = mappedModuleName;
      } else {
        resolvedModuleName = toRelative(path, resolved.resolvedFileName, mapExtension);
      }

      if (resolvedModuleName !== moduleName) {
        source.overwrite(
          specifier.getStart(sourceFile) + 1,
          specifier.getEnd() - 1,
          resolvedModuleName
        );
      }
    } else {
      onResolveFailed({ name: moduleName, importer: path });
    }
  }

  /**
   * @function visit
   * @description Visits each node in the AST and rewrites module specifiers
   * @param node The current AST node being visited
   */
  function visit(node: ts.Node) {
    let specifier: ts.Node | undefined;

    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      // import/export ... from 'module'
      specifier = node.moduleSpecifier;
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      // import('...')
      specifier = node.argument.literal;
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      // import ... = require('...')
      specifier = node.moduleReference.expression;
    }

    if (specifier && ts.isStringLiteral(specifier)) {
      rewriteSpecifier(specifier);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return source;
}

/**
 * @function rewriteSpecifiersInFile
 * @description Rewrites module specifiers in a TypeScript file
 * @param path The file path of the TypeScript file to rewrite
 * @param resolveModule A function that resolves module names to resolved modules
 * @param mapSpecifier A function that maps module specifiers
 * @param mapExtension A function that maps file extensions based on the importer
 * @param onResolveFailed A callback function that is called when module resolution fails
 */
export async function rewriteSpecifiersInFile(
  path: string,
  resolveModule: ResolveModule,
  mapSpecifier: MapSpecifier,
  mapExtension: MapExtension,
  onResolveFailed: OnResolveFailed
): Promise<boolean> {
  const content = await readFile(path, 'utf8');
  const source = transformFile(
    path,
    content,
    resolveModule,
    mapSpecifier,
    mapExtension,
    onResolveFailed
  );

  if (source.hasChanged()) {
    await writeFile(path, source.toString());

    return true;
  }

  return false;
}
