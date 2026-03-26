# dts-paths

<!-- prettier-ignore -->
> Replace alias paths with relative paths after typescript compilation.
>
> [![NPM Version][npm-image]][npm-url]
> [![Download Status][download-image]][npm-url]
> [![Languages Status][languages-image]][github-url]
> [![Tree Shakeable][tree-shakeable-image]][bundle-phobia-url]
> [![Side Effect][side-effect-image]][bundle-phobia-url]
> [![License][license-image]][license-url]

## Usage

### 1. Install

```bash
npm i -D dts-paths typescript
```

### 2. Compile declaration files first

```bash
tsc --emitDeclarationOnly
```

### 3. Rewrite alias paths in emitted files

```ts
import { resolvePaths } from 'dts-paths';

await resolvePaths('./dist/types', {
  tsconfig: './tsconfig.json'
});
```

### 4. Optional configuration

```ts
import { resolvePaths } from 'dts-paths';

await resolvePaths('./dist/types', {
  // Skip files that do not need to be processed
  exclude: path => path.includes('/internal/'),
  // Supports tsconfig path or inline tsconfig object
  tsconfig: './tsconfig.json',
  // Custom extension mapping strategy
  mapExtension: ({ extname, importer }) => {
    if (importer && extname === '.ts') return '.js';

    return extname;
  }
});
```

`resolvePaths` returns `Promise<Set<string>>`, and the set contains all files that were actually changed.

[npm-image]: https://img.shields.io/npm/v/dts-paths?style=flat-square
[npm-url]: https://www.npmjs.org/package/dts-paths
[download-image]: https://img.shields.io/npm/dm/dts-paths?style=flat-square
[languages-image]: https://img.shields.io/github/languages/top/nuintun/dts-paths?style=flat-square
[github-url]: https://github.com/nuintun/dts-paths
[tree-shakeable-image]: https://img.shields.io/badge/tree--shakeable-true-brightgreen?style=flat-square
[side-effect-image]: https://img.shields.io/badge/side--effect-free-brightgreen?style=flat-square
[bundle-phobia-url]: https://bundlephobia.com/result?p=dts-paths
[license-image]: https://img.shields.io/github/license/nuintun/dts-paths?style=flat-square
[license-url]: https://github.com/nuintun/dts-paths/blob/main/LICENSE
