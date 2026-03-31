/**
 * @module scanner
 */

import { Dirent, Stats } from 'node:fs';
import { LimitFunction } from 'p-limit';
import { join, resolve } from 'node:path';
import { lstat, readdir, realpath } from 'node:fs/promises';

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
 * @interface ReadEntry
 * @description an entry returned by the read function
 */
interface ReadEntry {
  /**
   * @property name
   * @description basename of the entry
   */
  name: string;
  /**
   * @property path
   * @description full path of the entry
   */
  path: string;
  /**
   * @property source
   * @description real path of the entry
   */
  source: string;
  /**
   * @property stat
   * @description the stat of the entry
   */
  stat: Dirent | Stats;
}

// waiting stack type
type Waiting = [
  // root path of the current iterator
  root: string,
  // async iterator of directory entries
  iterator: AsyncGenerator<ReadEntry>
];

/**
 * @function read
 * @description read directory entries
 * @param root the root directory to read
 * @param schedule the limit function to control concurrency
 */
async function* read(root: string, schedule: LimitFunction): AsyncGenerator<ReadEntry> {
  const dirents = await readdir(root, {
    withFileTypes: true
  });
  const entries: Promise<ReadEntry>[] = [];

  for (const dirent of dirents) {
    entries.push(
      schedule(async () => {
        const { name } = dirent;
        const path = join(root, name);

        let source = path;
        let stat: Dirent | Stats = dirent;

        if (dirent.isSymbolicLink()) {
          source = await realpath(path);
          stat = await lstat(source);
        }

        return { name, path, source, stat };
      })
    );
  }

  // wait for all entries to be read
  const results = await Promise.allSettled(entries);

  // yield fulfilled entries
  for (const result of results) {
    if (result.status === 'fulfilled') {
      yield result.value;
    }
  }
}

/**
 * @function scan
 * @description scan files in a directory recursively
 * @param root the root directory to scan for files
 * @param filter a filter function to determine which files to include
 * @param schedule the limit function to control concurrency
 */
export async function* scan(
  root: string,
  filter: Filter,
  schedule: LimitFunction
): AsyncGenerator<string> {
  root = resolve(root);

  const waiting: Waiting[] = [];
  const visited = new Set<string>([await realpath(root)]);

  let current: Waiting | undefined = [``, await read(root, schedule)];

  while (current) {
    const [, iterator] = current;
    const result = await iterator.next();

    if (result.done) {
      current = waiting.pop();
    } else {
      const entry = result.value;

      if (!visited.has(entry.source)) {
        visited.add(entry.source);

        const [root] = current;
        const { stat } = entry;
        const path = `${root}${entry.name}`;

        if (stat.isFile() && filter(path)) {
          yield entry.path;
        } else if (stat.isDirectory()) {
          waiting.push([`${path}/`, await read(entry.path, schedule)]);
        }
      }
    }
  }
}
