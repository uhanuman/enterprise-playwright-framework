import deepEqual from 'fast-deep-equal';
import fastJsonPatch from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';

export type JsonPatchOperation = Operation;

const { applyPatch, compare } = fastJsonPatch as unknown as {
  applyPatch<T>(document: T, patch: Operation[]): { newDocument: T };
  compare(left: unknown, right: unknown): Operation[];
};

export function diffJson<T>(left: T, right: T): Operation[] {
  return compare(left as never, right as never) as Operation[];
}

export function applyJsonPatch<T>(document: T, operations: Operation[]): T {
  return applyPatch(document, operations).newDocument as T;
}

export function applyMergePatch<T>(document: T, patch: unknown): T {
  const result = mergePatch(document, patch);
  return result as T;
}

function mergePatch(target: unknown, patch: unknown): unknown {
  if (patch === null) return null;
  if (Array.isArray(patch)) return patch;
  if (typeof patch === 'object') {
    const result: Record<string, unknown> = {};
    const targetObj = target && typeof target === 'object' && !Array.isArray(target)
      ? (target as Record<string, unknown>)
      : {};
    for (const [key, value] of Object.entries(targetObj)) {
      result[key] = value;
    }
    for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
      if (value === null) {
        delete result[key];
      } else {
        result[key] = mergePatch(targetObj[key], value);
      }
    }
    return result;
  }
  return patch;
}

export function isDeepEqual(left: unknown, right: unknown): boolean {
  return deepEqual(left, right);
}

export function assertJsonPatch(document: unknown, operations: Operation[]): void {
  const result = applyJsonPatch(document, operations);
  const reversed = compare(result as never, document as never);
  if (reversed.length > 0 && !isDeepEqual(reversed, operations.reverse())) {
    throw new Error('JSON Patch is not invertible');
  }
}