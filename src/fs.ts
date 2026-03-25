/**
 * @module fs
 */

import { Dirent } from 'node:fs';
import { join, resolve } from 'node:path';
import { readdir } from 'node:fs/promises';

/**
 * @interface Filter
 * @description Function interface for filtering file paths during directory scanning
 * @param {string} path The absolute file path to evaluate
 * @returns {boolean} true if the file should be included in results, false to exclude it
 */
export interface Filter {
  (path: string): boolean;
}

/**
 * @function read
 * @description Reads directory entries with file metadata information
 * @param {string} path Directory path to read
 * @returns {Promise<Iterator<Dirent>>} Async iterator of directory entries with file type information
 */
async function read(path: string) {
  // Read directory entries with file type information (without loading full stat info)
  const entries = await readdir(path, {
    withFileTypes: true
  });

  // Return iterator over entries for sequential processing
  return entries.values();
}

/**
 * @typedef {[string, Iterator<Dirent>]} Waiting
 * @description Tuple type representing a directory path prefix and its entry iterator
 * @property {string} 0 Path prefix relative to root directory (e.g., 'src/utils/')
 * @property {Iterator<Dirent>} 1 Iterator over directory entries for this directory
 */
type Waiting = [string, Iterator<Dirent>];

/**
 * @function scanFiles
 * @description Asynchronously scans a directory tree recursively and yields file paths that match the filter
 * @param {string} root Root directory to start scanning from
 * @param {Filter} [filter] Optional filter function to include/exclude files (defaults to including all files)
 * @yields {string} Absolute file paths that pass the filter criteria
 * @returns {AsyncGenerator<string>} Async generator yielding matching file paths
 */
export async function* scanFiles(
  root: string,
  filter: Filter = () => true
): AsyncGenerator<string> {
  // Resolve root to absolute path for consistent path handling
  root = resolve(root);

  // Stack of directories waiting to be processed (iterative DFS approach)
  const waiting: Waiting[] = [];

  // Start with root directory - empty prefix and root iterator
  let current: Waiting | undefined = ['', await read(root)];

  // Process directories iteratively (avoiding recursion depth limits on deep trees)
  while (current) {
    const [, iterator] = current;
    const item = iterator.next();

    if (item.done) {
      // Current directory exhausted, move to next waiting directory from stack
      current = waiting.pop();
    } else {
      const [dirname] = current;
      const { value: stat } = item;
      const path = `${dirname}${stat.name}`;

      // Yield file paths that pass the filter
      if (stat.isFile() && filter(path)) {
        yield join(root, path);
      }
      // Queue subdirectories for processing (depth-first traversal)
      else if (stat.isDirectory()) {
        const realpath = join(root, path);

        // Add to waiting stack with updated path prefix for nested files
        waiting.push([`${path}/`, await read(realpath)]);
      }
    }
  }
}
