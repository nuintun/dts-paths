/**
 * @module fix-types
 */

import { resolvePaths } from 'dts-paths';

Promise.all([
  resolvePaths('cjs', {
    tsconfig: {
      extends: './tsconfig.json',
      compilerOptions: {
        rootDir: './cjs',
        paths: {
          '/*': ['./cjs/*']
        }
      },
      include: ['./cjs/**/*']
    },
    mapExtension({ importer }) {
      return importer ? '.cjs' : '.cts';
    }
  }),
  resolvePaths('esm', {
    tsconfig: {
      extends: './tsconfig.json',
      compilerOptions: {
        rootDir: './esm',
        paths: {
          '/*': ['./esm/*']
        }
      },
      include: ['./esm/**/*']
    }
  })
]).then(
  ([esm, cjs]) => {
    console.log(`fix cjs types: ${cjs.size} files`);
    console.log(`fix esm types: ${esm.size} files`);
  },
  error => {
    console.error(error);
  }
);
