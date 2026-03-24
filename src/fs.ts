/**
 * @module fs
 */

import { Dirent } from 'node:fs';
import { join, resolve } from 'node:path';
import { readdir } from 'node:fs/promises';

interface Filter {
  (path: string): boolean;
}

async function read(path: string) {
  const entries = await readdir(path, {
    withFileTypes: true
  });

  return entries.values();
}

type Waiting = [string, Iterator<Dirent>];

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
