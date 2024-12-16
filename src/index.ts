/**
 * @module index
 */

import { resolve } from 'node:path';
import { Project, ProjectOptions, SourceFile, ts } from 'ts-morph';

const EXT_RE = /\.(?:(?:d\.)?([cm]?tsx?)|([cm]?jsx?))$/i;

type TsMorphConfigKeys = 'tsConfigFilePath' | 'compilerOptions';

export interface Options extends Pick<ProjectOptions, TsMorphConfigKeys> {
  exclude?: string[];
}

function getRelativeModulePath(resolvedFilePath: string, sourceFile: SourceFile) {
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

export default function resolvePaths(root: string, options: Options = {}): Promise<void> {
  const moduleResolution: Map<string, Map<string, string>> = new Map();
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
          const resolvedImports = moduleResolution.get(containingFile) || new Map<string, string>();

          if (!moduleResolution.has(containingFile)) {
            moduleResolution.set(containingFile, resolvedImports);
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
          console.log(getRelativeModulePath(resolvedFilePath, sourceFile));
        }
      }
    }
  }

  return project.save();
}
