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
  // Supports tsconfig path or inline tsconfig object
  tsconfig: './tsconfig.json',
  // Number of concurrent tasks for scanning/rewrite/rename stages
  concurrency: 16,
  // Skip files that do not need to be processed
  exclude: path => path.includes('/internal/'),
  // Rewrite module specifiers before resolving
  mapSpecifier: ({ specifier, importer }) => {
    if (importer.endsWith('legacy.d.ts') && specifier === 'lodash-es') {
      return 'lodash';
    }

    return specifier;
  },
  // Custom extension mapping strategy for import specifiers and file renaming
  mapExtension: ({ extname, importer }) => {
    // Import specifier rewrite stage
    if (importer && extname === '.ts') {
      return '.js';
    }

    // File rename stage: *.ts -> *.js, *.cts -> *.cjs, *.mts -> *.mjs by default
    return extname;
  },
  // Called when a specifier cannot be resolved
  onResolveFailed: ({ specifier, importer }) => {
    console.warn(`[dts-paths] failed to resolve '${specifier}' from '${importer}'`);
  }
});
```

## API

### `resolvePaths(root, options?)`

Returns `Promise<Set<string>>`; the set contains files whose content was rewritten. If a rewritten declaration file is renamed by `mapExtension`, the returned path is the renamed file path.

#### `options.tsconfig`

- Type: `string | TsConfig`
- Default: `'./tsconfig.json'`
- Supports either a tsconfig path or an inline object.
- Supported inline `TsConfig.compilerOptions` fields:
  - `paths`
  - `rootDir`
  - `preserveSymlinks`

#### `options.concurrency`

- Type: `number`
- Default: `32`
- Controls concurrent tasks for directory scanning, specifier rewriting, and output-file renaming.

#### `options.exclude`

- Type: `(path: string) => boolean`
- Default: `() => false`
- Filters declaration files during scanning.
- `path` is the relative path (from `root`) built with POSIX separators (for example: `foo/bar.d.ts`).

#### `options.mapSpecifier`

- Type: `(context: MapSpecifierContext) => string`
- Default: identity mapping (`specifier => specifier`)
- Called before resolving a module specifier.
- `context` contains:
  - `specifier`: module specifier from the original import/export
  - `importer`: file path of the declaration file that imports the package

#### `options.mapExtension`

- Type: `(context: MapExtensionContext) => string`
- Default mapping:
  - `.ts` / `.tsx` / `.jsx` -> `.js`
  - `.cts` -> `.cjs`
  - `.mts` -> `.mjs`
- Called in two places:
  - while rewriting import/export specifiers (`context.importer` is defined)
  - while renaming declaration output files (`context.importer` is undefined)

#### `options.onResolveFailed`

- Type: `(context: OnResolveFailedContext) => void`
- Default: throws an `Error`
- Called when a module specifier cannot be resolved.
- `context` contains:
  - `specifier`: unresolved module specifier from the original import/export
  - `importer`: file path of the declaration file that imports/exports the unresolved specifier

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
