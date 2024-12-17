/**
 * @module index
 */

import { resolvePaths } from 'dts-paths';

const changed = await resolvePaths('tests/types', {
  extensions: ['.ts', '.d.cts'],
  tsConfigFilePath: 'tests/tsconfig.json'
});

console.log(changed);
