/**
 * @module types
 */

import ts from 'typescript';
import { Filter } from './fs';

/**
 * @interface MapExternalContext
 * @description Context for mapping external module names
 */
export interface MapExternalContext {
  /**
   * @property name
   * @description The original module name being resolved
   */
  name: string;
  /**
   * @property importer
   * @description The file path that is importing the module
   */
  importer: string;
}

/**
 * @interface MapExtensionContext
 * @description Context for mapping file extensions
 */
export interface MapExtensionContext {
  /**
   * @property path
   * @description The resolved file path being processed
   */
  path: string;
  /**
   * @property extname
   * @description The original file extension of the resolved module
   */
  extname: string;
  /**
   * @property [importer]
   * @description The file path that is importing the module
   */
  importer?: string;
}

/**
 * @interface OnResolveFailedContext
 * @description Context for handling failed module resolution
 */
export interface OnResolveFailedContext {
  /**
   * @property name
   * @description Module specifier that failed to resolve
   */
  name: string;
  /**
   * @property importer
   * @description The file path that is importing the module
   */
  importer: string;
}

/**
 * @interface MapExternal
 * @description A function that maps external module names
 */
export interface MapExternal {
  /**
   * @param context The context for mapping the external module name
   */
  (context: MapExternalContext): string;
}

/**
 * @interface MapExtension
 * @description A function that maps file extensions based on the importer
 */
export interface MapExtension {
  /**
   * @param context The context for mapping the file extension
   */
  (context: MapExtensionContext): string;
}

/**
 * @interface OnResolveFailed
 * @description A callback function that is called when module resolution fails
 */
export interface OnResolveFailed {
  /**
   * @param context The context for handling the failed module resolution
   */
  (context: OnResolveFailedContext): void;
}

/**
 * @interface TsConfig
 * @description TypeScript configuration options
 */
export interface TsConfig {
  /**
   * @property [extends]
   * @description Path(s) to base tsconfig files
   */
  extends?: string | string[];
  /**
   * @property [compilerOptions]
   * @description Overrides for TypeScript compiler options
   */
  compilerOptions?: Pick<ts.CompilerOptions, 'paths' | 'rootDir'>;
}

/**
 * @interface Options
 * @description Options for the resolvePaths function
 */
export interface Options {
  /**
   * @property [exclude]
   * @description A filter function to exclude certain file paths from processing
   */
  exclude?: Filter;
  /**
   * @property [tsconfig]
   * @description Path to the TypeScript configuration file or configuration options
   */
  tsconfig?: string | TsConfig;
  /**
   * @property [mapExternal]
   * @description A function to map external module names
   */
  mapExternal?: MapExternal;
  /**
   * @property [mapExtension]
   * @description A function to map file extensions based on the importer
   */
  mapExtension?: MapExtension;
  /**
   * @property [onResolveFailed]
   * @description A callback function that is called when module resolution fails
   */
  onResolveFailed?: OnResolveFailed;
}
