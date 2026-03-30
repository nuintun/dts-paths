import ts from 'typescript';
import { Filter } from './fs';

export type { Filter };

export interface MapExternalContext {
  name: string;
  importer: string;
}

export interface MapExtensionContext {
  path: string;
  extname: string;
  importer?: string;
}

export interface OnResolveFailedContext {
  name: string;
  importer: string;
}

export interface MapExternal {
  (context: MapExternalContext): string;
}

export interface MapExtension {
  (context: MapExtensionContext): string;
}

export interface OnResolveFailed {
  (context: OnResolveFailedContext): void;
}

export interface TsConfig {
  extends?: string | string[];
  compilerOptions?: Pick<ts.CompilerOptions, 'paths' | 'rootDir'>;
}

export interface Options {
  exclude?: Filter;
  tsconfig?: string | TsConfig;
  mapExternal?: MapExternal;
  mapExtension?: MapExtension;
  onResolveFailed?: OnResolveFailed;
}
