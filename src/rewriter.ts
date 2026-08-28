/**
 * @module rewriter
 */

import { toRelative } from './shared';
import MagicString from 'magic-string';
import { ResolveModule } from './compiler';
import { parse, Visitor } from 'oxc-parser';
import { readFile, writeFile } from 'node:fs/promises';
import { MapExtension, MapSpecifier, OnResolveFailed } from './types';

// regular expression to match node_modules path
const NODE_MODULES_RE = /(?:^|[\\/])node_modules(?:[\\/]|$)/;

/**
 * @function transformFile
 * @description transforms a declaration file by rewriting its module specifiers
 * @param path the file path of the declaration file to transform
 * @param content the content of the declaration file
 * @param mapSpecifier a function that maps module specifiers
 * @param resolveModule a function that resolves module names
 * @param mapExtension a function that maps file extensions
 * @param onResolveFailed a callback that is called when module resolution fails
 */
async function transformFile(
  path: string,
  content: string,
  mapSpecifier: MapSpecifier,
  resolveModule: ResolveModule,
  mapExtension: MapExtension,
  onResolveFailed: OnResolveFailed
) {
  const result = await parse(path, content, {
    lang: 'dts',
    astType: 'ts'
  });

  if (result.errors.length > 0) {
    throw new Error(
      result.errors
        .map(error => {
          return error.codeframe ?? error.message;
        })
        .join('\n')
    );
  }

  const tasks: Promise<void>[] = [];
  const source = new MagicString(content);

  /**
   * @function rewriteSpecifier
   * @description rewrites a module specifier if it can be resolved
   * @param literal the string literal representing the module specifier
   */
  function rewriteSpecifier(literal: { value: string; start: number; end: number }) {
    tasks.push(
      (async () => {
        const specifier = literal.value;
        const mappedSpecifier = mapSpecifier({
          specifier,
          importer: path
        });

        const resolved = await resolveModule(mappedSpecifier, path);

        if (resolved.path == null) {
          return onResolveFailed({
            specifier,
            importer: path
          });
        }

        const resolvedSpecifier = toRelative(path, resolved.path, mapExtension);

        if (resolvedSpecifier !== specifier && !NODE_MODULES_RE.test(resolvedSpecifier)) {
          source.overwrite(literal.start + 1, literal.end - 1, resolvedSpecifier);
        }
      })()
    );
  }

  const visitor = new Visitor({
    ImportDeclaration(node) {
      rewriteSpecifier(node.source);
    },

    ExportNamedDeclaration(node) {
      if (node.source) {
        rewriteSpecifier(node.source);
      }
    },

    ExportAllDeclaration(node) {
      rewriteSpecifier(node.source);
    },

    TSImportType(node) {
      rewriteSpecifier(node.source);
    },

    TSImportEqualsDeclaration(node) {
      if (node.moduleReference.type === 'TSExternalModuleReference') {
        rewriteSpecifier(node.moduleReference.expression);
      }
    }
  });

  visitor.visit(result.program);

  await Promise.all(tasks);

  return source;
}

/**
 * @function rewriteSpecifiersInFile
 * @description Rewrites module specifiers in a declaration file
 * @param path the file path of the declaration file
 * @param mapSpecifier a function that maps module specifiers
 * @param resolveModule a function that resolves module names
 * @param mapExtension a function that maps file extensions
 * @param onResolveFailed a callback that is called when module resolution fails
 */
export async function rewriteSpecifiersInFile(
  path: string,
  mapSpecifier: MapSpecifier,
  resolveModule: ResolveModule,
  mapExtension: MapExtension,
  onResolveFailed: OnResolveFailed
): Promise<boolean> {
  const content = await readFile(path, 'utf8');
  const source = await transformFile(path, content, mapSpecifier, resolveModule, mapExtension, onResolveFailed);

  if (source.hasChanged()) {
    await writeFile(path, source.toString());

    return true;
  }

  return false;
}
