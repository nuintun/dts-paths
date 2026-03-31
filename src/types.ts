/**
 * @module types
 */

import ts from 'typescript';
import { Filter } from './scanner';

/**
 * @interface MapSpecifierContext
 * @description context for mapping module specifiers
 */
export interface MapSpecifierContext {
  /**
   * @property specifier
   * @description the original module specifier being resolved
   */
  specifier: string;
  /**
   * @property importer
   * @description the file path that is importing the module
   */
  importer: string;
}

/**
 * @interface MapExtensionContext
 * @description context for mapping file extensions
 */
export interface MapExtensionContext {
  /**
   * @property path
   * @description the resolved file path being processed
   */
  path: string;
  /**
   * @property extname
   * @description the original file extension of the resolved module
   */
  extname: string;
  /**
   * @property [importer]
   * @description the file path that is importing the module
   */
  importer?: string;
}

/**
 * @interface OnResolveFailedContext
 * @description context for handling failed module resolution
 */
export interface OnResolveFailedContext {
  /**
   * @property specifier
   * @description the module specifier that failed to resolve
   */
  specifier: string;
  /**
   * @property importer
   * @description the file path that is importing the module
   */
  importer: string;
}

/**
 * @interface MapSpecifier
 * @description a function that maps module specifiers
 */
export interface MapSpecifier {
  /**
   * @param context the context for mapping the module specifier
   */
  (context: MapSpecifierContext): string;
}

/**
 * @interface MapExtension
 * @description a function that maps file extensions based on the importer
 */
export interface MapExtension {
  /**
   * @param context the context for mapping the file extension
   */
  (context: MapExtensionContext): string;
}

/**
 * @interface OnResolveFailed
 * @description a callback function that is called when module resolution fails
 */
export interface OnResolveFailed {
  /**
   * @param context the context for handling the failed module resolution
   */
  (context: OnResolveFailedContext): void;
}

/**
 * @interface TsConfig
 * @description typescript configuration options
 */
export interface TsConfig {
  /**
   * @property [extends]
   * @description path(s) to base tsconfig files
   */
  extends?: string | string[];
  /**
   * @property [compilerOptions]
   * @description overrides for typescript compiler options
   */
  compilerOptions?: Pick<
    ts.CompilerOptions,
    // typescript path alias
    | 'paths'
    // typescript root directory
    | 'rootDir'
    // typescript preserve symlinks
    | 'preserveSymlinks'
  >;
}

/**
 * @interface Options
 * @description options for the resolvePaths function
 */
export interface Options {
  /**
   * @property [exclude]
   * @description a filter function to exclude certain file paths from processing
   */
  exclude?: Filter;
  /**
   * @property [concurrency]
   * @description number of concurrent tasks to run
   */
  concurrency?: number;
  /**
   * @property [tsconfig]
   * @description path to the typescript configuration file or configuration options
   */
  tsconfig?: string | TsConfig;
  /**
   * @property [mapSpecifier]
   * @description a function to map module specifiers
   */
  mapSpecifier?: MapSpecifier;
  /**
   * @property [mapExtension]
   * @description a function to map file extensions based on the importer
   */
  mapExtension?: MapExtension;
  /**
   * @property [onResolveFailed]
   * @description a callback function that is called when module resolution fails
   */
  onResolveFailed?: OnResolveFailed;
}
