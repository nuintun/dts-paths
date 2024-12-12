/**
 * @module index
 */

import { resolve } from 'node:path';
import { Project, ts } from 'ts-morph';

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  tsConfigFilePath: resolve('tests/tsconfig.json'),
  resolutionHost(moduleResolutionHost, getCompilerOptions) {
    return {
      resolveModuleNames(moduleNames, containingFile) {
        const compilerOptions = getCompilerOptions();
        const resolvedModules: (ts.ResolvedModule | undefined)[] = [];

        for (const moduleName of moduleNames) {
          const { resolvedModule } = ts.resolveModuleName(
            moduleName,
            containingFile,
            compilerOptions,
            moduleResolutionHost,
            ts.createModuleResolutionCache('.ts', name => name)
          );

          resolvedModules.push(resolvedModule);

          if (resolvedModule && !resolvedModule.isExternalLibraryImport) {
            console.log(moduleName, resolvedModule.resolvedFileName);
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
    const file = literal.getLiteralValue();

    console.log(sourceFilePath, file, sourceFile.getRelativePathAsModuleSpecifierTo(file));
  }
}
