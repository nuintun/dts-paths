/**
 * @module fs
 */

import { Dirent } from 'node:fs';
import { join, resolve } from 'node:path';
import { readdir } from 'node:fs/promises';

/**
 * @interface Filter
 * @description a function to filter file paths
 */
export interface Filter {
  /**
   * @param path the file path to filter
   */
  (path: string): boolean;
}

/**
 * @function read
 * @description read directory entries
 * @param path the directory path to read
 */
async function read(path: string) {
  const entries = await readdir(path, {
    withFileTypes: true
  });

  return entries.values();
}

// async generator to scan files in a directory recursively
type Waiting = [string, Iterator<Dirent>];

/**
 * @function scanFiles
 * @description scan files in a directory recursively
 * @param root the root directory to scan for files
 * @param filter a filter function to determine which files to include
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
      const { value: stat } = item;

      if (!stat.isSymbolicLink()) {
        const [dirname] = current;
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
}
