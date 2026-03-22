import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

interface Storage {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
}

function createFileStorage(dir: string): Storage {
  const ensureDir = mkdir(dir, { recursive: true });

  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      await ensureDir;
      try {
        const data = await readFile(join(dir, `${key}.json`), 'utf-8');
        return JSON.parse(data) as T;
      } catch {
        return null;
      }
    },

    async set(key: string, value: unknown): Promise<void> {
      await ensureDir;
      await writeFile(join(dir, `${key}.json`), JSON.stringify(value, null, 2));
    },
  };
}

export { createFileStorage };
export type { Storage };
