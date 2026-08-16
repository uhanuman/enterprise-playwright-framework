import fs from 'node:fs/promises';
import path from 'node:path';
import { parseJson, parseJsonSafe, stringify } from './parse.js';
import { JsonObject } from './transform.js';

export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf8');
  return parseJson<T>(content);
}

export async function readJsonFileSafe<T = unknown>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return parseJsonSafe<T>(content, fallback);
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(filePath: string, value: unknown, pretty = true): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, stringify(value, pretty), 'utf8');
}

export async function updateJsonFile(filePath: string, updater: (current: unknown) => unknown): Promise<void> {
  const current = await readJsonFile<unknown>(filePath);
  const next = updater(current);
  await writeJsonFile(filePath, next);
}

export async function deleteJsonKeys(filePath: string, keys: string[]): Promise<void> {
  await updateJsonFile(filePath, (current) => {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      const obj = current as JsonObject;
      for (const key of keys) {
        delete obj[key];
      }
      return obj;
    }
    return current;
  });
}

export async function appendToJsonArray(filePath: string, value: unknown): Promise<void> {
  await updateJsonFile(filePath, (current) => {
    if (Array.isArray(current)) {
      return [...current, value];
    }
    return [value];
  });
}

export function jsonFileExists(filePath: string): boolean {
  try {
    const fsSync = require('node:fs') as typeof import('node:fs');
    return fsSync.existsSync(filePath);
  } catch {
    return false;
  }
}