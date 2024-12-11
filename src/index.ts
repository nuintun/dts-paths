/**
 * @module index
 */

import { Project } from 'ts-morph';
import { resolve } from 'node:path';

const project = new Project({
  tsConfigFilePath: resolve('tests/tsconfig.json')
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
