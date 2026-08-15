export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export function parseJson<T = JsonValue>(content: string): T {
  return JSON.parse(content) as T;
}

export function parseJsonSafe<T = JsonValue>(content: string, fallback: T): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

export function stringify(value: unknown, pretty = false): string {
  return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}

export function prettyPrint(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function minify(value: unknown): string {
  return JSON.stringify(value);
}

export function isJsonValid(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

export function parseJsonLines<T = JsonValue>(content: string): T[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => parseJson<T>(line));
}

export function toJsonLines(values: unknown[]): string {
  return values.map((value) => JSON.stringify(value)).join('\n');
}