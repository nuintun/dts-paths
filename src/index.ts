/**
 * @module index
 */

import { resolve } from 'node:path';
import { Project, ts } from 'ts-morph';

const EXT_RE = /\.(?:(?:d\.)?[cm]?tsx?|[cm]?jsx?)$/i;

export default function resolvePaths(): Promise<void> {
  const importsMap: Map<string, Map<string, string>> = new Map();

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    tsConfigFilePath: resolve('tests/tsconfig.json'),
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

  const sourceFiles = project.addSourceFilesAtPaths('tests/types/**/*.{ts,cts}');

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
          const relativeFilePath = sourceFile.getRelativePathTo(resolvedFilePath);

          console.log(sourceFilePath, resolvedFilePath, `${relativeFilePath.replace(EXT_RE, '')}.js`);
        }
      }
    }
  }

  return project.save();
}
