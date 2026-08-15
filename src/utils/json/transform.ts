export type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepMerge(base: unknown, patch: unknown): unknown {
  if (isObject(base) && isObject(patch)) {
    const result: JsonObject = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      result[key] = deepMerge(base[key], value);
    }
    return result;
  }
  if (Array.isArray(base) && Array.isArray(patch)) {
    return [...base, ...patch];
  }
  return patch;
}

export function shallowMerge(base: JsonObject, patch: JsonObject): JsonObject {
  return { ...base, ...patch };
}

export function flatten(input: unknown, prefix = '', separator = '.'): JsonObject {
  const result: JsonObject = {};
  if (isObject(input)) {
    for (const [key, value] of Object.entries(input)) {
      const path = prefix ? `${prefix}${separator}${key}` : key;
      Object.assign(result, flatten(value, path, separator));
    }
  } else if (Array.isArray(input)) {
    input.forEach((value, index) => {
      const path = prefix ? `${prefix}${separator}${index}` : String(index);
      Object.assign(result, flatten(value, path, separator));
    });
  } else {
    result[prefix] = input;
  }
  return result;
}

export function unflatten(input: JsonObject, separator = '.'): unknown {
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(input)) {
    const parts = key.split(separator);
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || !isObject(current[part])) {
        current[part] = {};
      }
      current = current[part] as JsonObject;
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

export function project(input: JsonObject, paths: string[], separator = '.'): JsonObject {
  const result: JsonObject = {};
  for (const path of paths) {
    const value = getByPath(input, path, separator);
    if (value !== undefined) {
      result[path] = value;
    }
  }
  return result;
}

export function getByPath(input: unknown, path: string, separator = '.'): unknown {
  const parts = path.split(separator);
  let current: unknown = input;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as JsonObject)) {
      current = (current as JsonObject)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export function setByPath(input: JsonObject, path: string, value: unknown, separator = '.'): JsonObject {
  const parts = path.split(separator);
  let current = input;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || !isObject(current[part])) {
      current[part] = {};
    }
    current = current[part] as JsonObject;
  }
  current[parts[parts.length - 1]] = value;
  return input;
}

export function deleteByPath(input: JsonObject, path: string, separator = '.'): JsonObject {
  const parts = path.split(separator);
  let current = input;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || !isObject(current[part])) {
      return input;
    }
    current = current[part] as JsonObject;
  }
  delete current[parts[parts.length - 1]];
  return input;
}

export function mapKeys(input: JsonObject, mapper: (key: string) => string): JsonObject {
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(input)) {
    result[mapper(key)] = isObject(value) ? mapKeys(value, mapper) : value;
  }
  return result;
}

export function mapValues(input: unknown, mapper: (value: unknown, key: string) => unknown): unknown {
  if (Array.isArray(input)) return input.map((value) => mapValues(value, mapper));
  if (isObject(input)) {
    const result: JsonObject = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = mapValues(value, mapper);
    }
    return result;
  }
  return mapper(input, '');
}

export function purgeNulls(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(purgeNulls).filter((value) => value !== null && value !== undefined);
  if (isObject(input)) {
    const result: JsonObject = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== null && value !== undefined) {
        result[key] = purgeNulls(value);
      }
    }
    return result;
  }
  return input;
}

export function deepClone<T>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}