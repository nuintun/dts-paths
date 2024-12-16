/**
 * @module index
 */

import { resolve } from 'node:path';
import { Project, ProjectOptions, SourceFile, ts } from 'ts-morph';

const EXT_RE = /\.(?:(?:d\.)?([cm]?tsx?)|([cm]?jsx?))$/i;

type PickedProps = 'tsConfigFilePath' | 'compilerOptions';

export interface Options extends Pick<ProjectOptions, PickedProps> {
  exclude?: string[];
}

function getRelativeModuleName(resolvedFilePath: string, sourceFile: SourceFile) {
  const relativeFilePath = sourceFile.getRelativePathTo(resolvedFilePath);
  const moduleName = relativeFilePath.replace(EXT_RE, (match, ts?: string, js?: string) => {
    const ext = ts || js;

    if (ext) {
      switch (ext.toLowerCase()) {
        case 'ts':
        case 'tsx':
          return '.js';
        case 'cts':
        case 'ctsx':
          return '.cjs';
        case 'mts':
        case 'mtsx':
          return '.mjs';
        default:
          return match;
      }
    }

    return match;
  });

  return moduleName.startsWith('.') ? moduleName : `./${moduleName}`;
}

export default function resolvePaths(root: string, options: Options = {}): Promise<void> {
  const importsMap: Map<string, Map<string, string>> = new Map();
  const { tsConfigFilePath = 'tsconfig.json', exclude = ['node_modules'] } = options;

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    tsConfigFilePath: resolve(tsConfigFilePath),
    resolutionHost(moduleResolutionHost, getCompilerOptions) {
      const compilerOptions = getCompilerOptions();

      return {
        resolveModuleNames(moduleNames, containingFile) {
          const resolvedModules: (ts.ResolvedModule | undefined)[] = [];
          const resolutionsMap = importsMap.get(containingFile) || new Map<string, string>();

          if (!importsMap.has(containingFile)) {
            importsMap.set(containingFile, resolutionsMap);
          }

          for (const moduleName of moduleNames) {
            const { resolvedModule } = ts.resolveModuleName(
              // 模块名称
              moduleName,
              // 当前文件
              containingFile,
              // 编译选项
              compilerOptions,
              // 模块解析器
              moduleResolutionHost
            );

            resolvedModules.push(resolvedModule);

            if (resolvedModule && !resolvedModule.isExternalLibraryImport) {
              resolutionsMap.set(moduleName, resolvedModule.resolvedFileName);
            }
          }

          return resolvedModules;
        }
      };
    }
  });

  const include = resolve(root, '**/*.{ts,cts}');
  const sourceFiles = project.addSourceFilesAtPaths([include, ...exclude]);

  project.resolveSourceFileDependencies();

  for (const sourceFile of sourceFiles) {
    const sourceFilePath = sourceFile.getFilePath();
    const resolutionsMap = importsMap.get(sourceFilePath);

    if (resolutionsMap) {
      const importLiterals = sourceFile.getImportStringLiterals();

      for (const importLiteral of importLiterals) {
        const moduleName = importLiteral.getLiteralValue();
        const resolvedFilePath = resolutionsMap.get(moduleName);

        if (resolvedFilePath) {
          console.log(getRelativeModuleName(resolvedFilePath, sourceFile));
        }
      }
    }
  }

  return project.save();
}
