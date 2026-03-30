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
 * @description transforms a typescript file by rewriting its module specifiers
 * @param path the file path of the typescript file to transform
 * @param content the content of the typescript file
 * @param mapSpecifier a function that maps module specifiers
 * @param resolveModule a function that resolves module names to resolved modules
 * @param mapExtension a function that maps file extensions based on the importer
 * @param onResolveFailed a callback function that is called when module resolution fails
 */
function transformFile(
  path: string,
  content: string,
  mapSpecifier: MapSpecifier,
  resolveModule: ResolveModule,
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
   * @description rewrites a module specifier if it can be resolved
   * @param literal the string literal representing the module specifier
   */
  function rewriteSpecifier(literal: ts.StringLiteral) {
    const specifier = literal.text;
    const mappedSpecifier = mapSpecifier({ specifier, importer: path });
    const resolved = resolveModule(mappedSpecifier, path);

    if (resolved) {
      let resolvedSpecifier: string;

      if (resolved.isExternalLibraryImport) {
        resolvedSpecifier = mappedSpecifier;
      } else {
        resolvedSpecifier = toRelative(path, resolved.resolvedFileName, mapExtension);
      }

      if (resolvedSpecifier !== specifier) {
        source.overwrite(literal.getStart(sourceFile) + 1, literal.getEnd() - 1, resolvedSpecifier);
      }
    } else {
      onResolveFailed({ specifier, importer: path });
    }
  }

  /**
   * @function visit
   * @description visits each node in the AST and rewrites module specifiers
   * @param node the current ast node being visited
   */
  function visit(node: ts.Node) {
    let literal: ts.Node | undefined;

    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      // import/export ... from 'module'
      literal = node.moduleSpecifier;
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      // import('...')
      literal = node.argument.literal;
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      // import ... = require('...')
      literal = node.moduleReference.expression;
    }

    if (literal && ts.isStringLiteral(literal)) {
      rewriteSpecifier(literal);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return source;
}

/**
 * @function rewriteSpecifiersInFile
 * @description Rewrites module specifiers in a typescript file
 * @param path the file path of the typescript file to rewrite
 * @param mapSpecifier a function that maps module specifiers
 * @param resolveModule a function that resolves module names to resolved modules
 * @param mapExtension a function that maps file extensions based on the importer
 * @param onResolveFailed a callback function that is called when module resolution fails
 */
export async function rewriteSpecifiersInFile(
  path: string,
  mapSpecifier: MapSpecifier,
  resolveModule: ResolveModule,
  mapExtension: MapExtension,
  onResolveFailed: OnResolveFailed
): Promise<boolean> {
  const content = await readFile(path, 'utf8');
  const source = transformFile(
    path,
    content,
    mapSpecifier,
    resolveModule,
    mapExtension,
    onResolveFailed
  );

  if (source.hasChanged()) {
    await writeFile(path, source.toString());

    return true;
  }

  return false;
}
