/**
 * @module index
 */

import { resolvePaths } from 'dts-paths';

const changed = await resolvePaths('tests/types', {
  tsconfig: {
    compilerOptions: {
      moduleResolution: 'bundler',
      paths: {
        '/*': ['./tests/types/*']
      }
    }
  }
});

console.log(changed);
