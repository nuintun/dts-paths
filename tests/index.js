/**
 * @module index
 */

import resolvePaths from 'dts-paths';

const changed = await resolvePaths('tests/types', {
  tsConfigFilePath: 'tests/tsconfig.json'
});

console.log(changed);
