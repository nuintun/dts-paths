/**
 * @module fs
 */

import { Dirent } from 'node:fs';
import { join, resolve } from 'node:path';
import { readdir } from 'node:fs/promises';

/**
 * @interface Filter
 * @description Function interface for filtering file paths
 */
interface Filter {
  /**
   * @param path The file path to filter
   * @returns true if the file should be included, false otherwise
   */
  (path: string): boolean;
}

/**
 * @function read
 * @description Reads directory entries with file metadata
 * @param path Directory path to read
 * @returns Async iterator of directory entries
 */
async function read(path: string) {
  const entries = await readdir(path, {
    withFileTypes: true
  });

  return entries.values();
}

/**
 * @type Waiting
 * @description Tuple type representing a directory path and its entry iterator
 */
type Waiting = [string, Iterator<Dirent>];

/**
 * @function scanFiles
 * @description Asynchronously scans a directory tree and yields file paths that match the filter
 * @param root Root directory to start scanning from
 * @param filter Optional filter function to include/exclude files
 * @yields Absolute file paths that match the filter criteria
 */
export async function* scanFiles(
  root: string,
  filter: Filter = () => true
): AsyncGenerator<string> {
  root = resolve(root);

  const waiting: Waiting[] = [];

  let current: Waiting | undefined = ['', await read(root)];

  while (current) {
    const [, iterator] = current;
    const item = iterator.next();

    if (item.done) {
      current = waiting.pop();
    } else {
      const [dirname] = current;
      const { value: stat } = item;
      const path = `${dirname}${stat.name}`;

      if (stat.isFile() && filter(path)) {
        yield join(root, path);
      } else if (stat.isDirectory()) {
        const realpath = join(root, path);

        waiting.push([`${path}/`, await read(realpath)]);
      }
    }
  }
}
