/**
 * @module index
 */

import { resolve } from 'node:path';
import { Project, ts } from 'ts-morph';

export default function resolvePaths(): Promise<void> {
  const mapping: Map<string, string> = new Map();

  const project = new Project({
    compilerOptions: {
      declarationDir: resolve('tests/changed')
    },
    skipAddingFilesFromTsConfig: true,
    tsConfigFilePath: resolve('tests/tsconfig.json'),
    resolutionHost(moduleResolutionHost, getCompilerOptions) {
      const compilerOptions = getCompilerOptions();

      return {
        resolveModuleNames(moduleNames, containingFile) {
          const resolvedModules: (ts.ResolvedModule | undefined)[] = [];

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
              mapping.set(moduleName, resolvedModule.resolvedFileName);
            }
          }

          return resolvedModules;
        }
      };
    }
  });

  const sourceFiles = project.addSourceFilesAtPaths('tests/types/**/*.{ts,cts}');

  for (const sourceFile of sourceFiles) {
    const sourceFilePath = sourceFile.getFilePath();
    const literals = sourceFile.getImportStringLiterals();

    for (const literal of literals) {
      const alias = literal.getLiteralValue();
      const file = mapping.get(alias);

      if (file) {
        const relative = sourceFile.getRelativePathAsModuleSpecifierTo(file);

        console.log(sourceFilePath, alias, `${relative}.js`);
      }
    }
  }

  return project.save();
}
