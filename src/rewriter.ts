import ts from 'typescript';
import MagicString from 'magic-string';
import { readFile, writeFile } from 'node:fs/promises';
import { toRelative } from './shared';
import { MapExtension, MapExternal, OnResolveFailed } from './types';
import { ResolveModule } from './compiler';

function transformFile(
  path: string,
  content: string,
  resolveModule: ResolveModule,
  mapExternal: MapExternal,
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

  function rewriteSpecifier(specifier: ts.StringLiteral) {
    const moduleName = specifier.text;
    const resolved = resolveModule(moduleName, path);

    if (resolved) {
      let resolvedModuleName: string;

      if (resolved.isExternalLibraryImport) {
        resolvedModuleName = mapExternal({ name: moduleName, importer: path });
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

  function visit(node: ts.Node) {
    let specifier: ts.Node | undefined;

    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      specifier = node.argument.literal;
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
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

export async function rewriteSpecifiersInFile(
  path: string,
  resolveModule: ResolveModule,
  mapExternal: MapExternal,
  mapExtension: MapExtension,
  onResolveFailed: OnResolveFailed
): Promise<boolean> {
  const content = await readFile(path, 'utf8');
  const source = transformFile(
    path,
    content,
    resolveModule,
    mapExternal,
    mapExtension,
    onResolveFailed
  );

  if (source.hasChanged()) {
    await writeFile(path, source.toString());

    return true;
  }

  return false;
}
