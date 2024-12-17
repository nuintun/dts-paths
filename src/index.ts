/**
 * @module index
 */

import { resolve } from 'node:path';
import { Project, ProjectOptions, SourceFile, ts } from 'ts-morph';

const EXT_RE = /\.(?:(?:d\.)?([cm]?tsx?)|([cm]?jsx?))$/i;

function resolveModuleName(
  moduleName: string,
  extensions: string[],
  containingFile: string,
  compilerOptions: ts.CompilerOptions,
  moduleResolutionHost: ts.ModuleResolutionHost
): ts.ResolvedModule | undefined {
  for (const extension of extensions) {
    for (const suffix of [`.${extension}`, `/index.${extension}`]) {
      const { resolvedModule } = ts.resolveModuleName(
        `${moduleName}${suffix}`,
        containingFile,
        compilerOptions,
        moduleResolutionHost
      );

      if (resolvedModule) {
        return resolvedModule;
      }
    }
  }

  const { resolvedModule } = ts.resolveModuleName(
    // Module name.
    moduleName,
    // Containing file.
    containingFile,
    // Compiler options.
    compilerOptions,
    // Module resolution host
    moduleResolutionHost
  );

  return resolvedModule;
}

type TsMorphConfigKeys = 'tsConfigFilePath' | 'compilerOptions';

export interface Options extends Pick<ProjectOptions, TsMorphConfigKeys> {
  exclude?: string[];
  extensions?: string[];
}

function getRelativeModulePath(resolvedFilePath: string, sourceFile: SourceFile): string {
  const relativePath = sourceFile.getRelativePathTo(resolvedFilePath);
  const modulePath = relativePath.replace(EXT_RE, (match, tsExt?: string, jsExt?: string) => {
    const fileExt = tsExt || jsExt;

    if (fileExt) {
      switch (fileExt.toLowerCase()) {
        case 'js':
        case 'ts':
        case 'jsx':
        case 'tsx':
          return '.js';
        case 'cjs':
        case 'cts':
        case 'cjsx':
        case 'ctsx':
          return '.cjs';
        case 'mjs':
        case 'mts':
        case 'mjsx':
        case 'mtsx':
          return '.mjs';
        default:
          return match;
      }
    }

    return match;
  });

  return modulePath.startsWith('.') ? modulePath : `./${modulePath}`;
}

/**
 * @function resolvePaths
 * @description Resolve dts import paths.
 * @param root The root directory of dts.
 * @param options The options of resolve.
 * @return {Promise<Set<string>>}
 */
export default async function resolvePaths(
  root: string,
  {
    compilerOptions,
    exclude = ['node_modules'],
    tsConfigFilePath = 'tsconfig.json',
    extensions = ['ts', 'cts', 'mts', 'd.ts', 'd.cts', 'd.mts']
  }: Options = {}
): Promise<Set<string>> {
  const changed = new Set<string>();
  const moduleResolution = new Map<string, Map<string, string>>();

  const project = new Project({
    compilerOptions,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    tsConfigFilePath: resolve(tsConfigFilePath),
    resolutionHost(moduleResolutionHost, getCompilerOptions) {
      const compilerOptions = getCompilerOptions();

      return {
        resolveModuleNames(moduleNames, containingFile) {
          const resolvedModules: (ts.ResolvedModule | undefined)[] = [];
          const resolvedImports = moduleResolution.get(containingFile) || new Map<string, string>();

          if (!moduleResolution.has(containingFile)) {
            moduleResolution.set(containingFile, resolvedImports);
          }

          for (const moduleName of moduleNames) {
            const resolvedModule = resolveModuleName(
              moduleName,
              extensions,
              containingFile,
              compilerOptions,
              moduleResolutionHost
            );

            resolvedModules.push(resolvedModule);

            if (resolvedModule && !resolvedModule.isExternalLibraryImport) {
              resolvedImports.set(moduleName, resolvedModule.resolvedFileName);
            }
          }

          return resolvedModules;
        }
      };
    }
  });

  const include = resolve(root, '**/*.{ts,cts,mts,tsx,ctsx,mtsx}');
  const sourceFiles = project.addSourceFilesAtPaths([include, ...exclude]);

  project.resolveSourceFileDependencies();

  for (const sourceFile of sourceFiles) {
    const sourceFilePath = sourceFile.getFilePath();
    const resolvedImports = moduleResolution.get(sourceFilePath);

    if (resolvedImports) {
      const importLiterals = sourceFile.getImportStringLiterals();

      for (const importLiteral of importLiterals) {
        const moduleName = importLiteral.getLiteralValue();
        const resolvedFilePath = resolvedImports.get(moduleName);

        if (resolvedFilePath) {
          const relativeModulePath = getRelativeModulePath(resolvedFilePath, sourceFile);

          if (relativeModulePath !== moduleName) {
            changed.add(relativeModulePath);

            importLiteral.setLiteralValue(relativeModulePath);
          }
        }
      }
    }
  }

  await project.save();

  return changed;
}
