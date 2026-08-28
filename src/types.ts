/**
 * @module types
 */

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
 * @description context for handling module resolution failure
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
   * @param context the context for mapping module specifiers
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
 * @description a function that is called when module resolution fails
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
  compilerOptions?: {
    // typescript root directory
    rootDir?: string;
    // typescript preserve symlinks
    preserveSymlinks?: boolean;
    // typescript path alias
    paths?: Record<string, string[]>;
  };
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
   * @description tsconfig path or object.
   * object is treated as a virtual tsconfig in cwd,
   * following standard tsconfig rules.
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
