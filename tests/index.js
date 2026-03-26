/**
 * @module index
 */

import { resolvePaths } from 'dts-paths';

const changed = await resolvePaths('tests/types', {
  tsconfig: './tests/tsconfig.json'
});

console.log(changed);
