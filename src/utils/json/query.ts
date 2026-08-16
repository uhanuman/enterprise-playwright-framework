import { JSONPath } from 'jsonpath-plus';
import { JsonObject } from './transform.js';

export function jsonPathQuery(input: unknown, expression: string): unknown[] {
  const result = JSONPath({ path: expression, json: input as never }) as unknown;
  return Array.isArray(result) ? result : [];
}

export function findKeys(input: unknown, predicate: (key: string, value: unknown, path: string) => boolean): string[] {
  const matches: string[] = [];
  const walk = (value: unknown, path: string, key: string): void => {
    if (predicate(key, value, path)) {
      matches.push(path || key);
    }
    if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value as JsonObject)) {
        walk(childValue, path ? `${path}.${childKey}` : childKey, childKey);
      }
    }
  };
  walk(input, '', '');
  return matches;
}

export function searchValues(input: unknown, searchTerm: unknown): string[] {
  const results: string[] = [];
  const walk = (value: unknown, path: string): void => {
    if (value === searchTerm) {
      results.push(path);
    }
    if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value as JsonObject)) {
        walk(childValue, path ? `${path}.${childKey}` : childKey);
      }
    }
  };
  walk(input, '');
  return results;
}

export function getValuesByPath(input: unknown, path: string): unknown[] {
  return jsonPathQuery(input, path);
}

export type AggregationOp = 'sum' | 'avg' | 'min' | 'max' | 'count';

export function aggregate(input: unknown, path: string, op: AggregationOp): number {
  const values = jsonPathQuery(input, path).filter((v) => typeof v === 'number') as number[];
  if (op === 'count') return values.length;
  if (values.length === 0) return 0;
  switch (op) {
    case 'sum':
      return values.reduce((acc, v) => acc + v, 0);
    case 'avg':
      return values.reduce((acc, v) => acc + v, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
  }
}