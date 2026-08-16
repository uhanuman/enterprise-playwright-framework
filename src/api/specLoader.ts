import path from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

export interface OperationSpec {
  operationId?: string;
  summary?: string;
  description?: string;
  path: string;
  method: HttpMethod;
  parameters: unknown[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
  tags?: string[];
}

export interface OpenApiSpec {
  title: string;
  version: string;
  operations: OperationSpec[];
  findOperation(method: HttpMethod, path: string): OperationSpec | undefined;
  findOperationById(operationId: string): OperationSpec | undefined;
  resolveRef(ref: string): unknown;
}

interface ParsedSpec {
  info?: { title?: string; version?: string };
  paths?: Record<string, Record<string, unknown>>;
  components?: Record<string, unknown>;
}

export class SpecLoader {
  private readonly cached: Map<string, OpenApiSpec> = new Map();

  async load(filePath: string): Promise<OpenApiSpec> {
    const resolvedPath = path.resolve(filePath);
    if (this.cached.has(resolvedPath)) return this.cached.get(resolvedPath)!;

    const api = (await SwaggerParser.dereference(resolvedPath)) as unknown as ParsedSpec;
    const operations: OperationSpec[] = [];

    for (const [pathKey, pathItem] of Object.entries(api.paths ?? {})) {
      for (const [method, rawOperation] of Object.entries(pathItem ?? {})) {
        if (!isHttpMethod(method)) continue;
        const operation = rawOperation as Record<string, unknown>;
        operations.push({
          operationId: operation.operationId as string | undefined,
          summary: operation.summary as string | undefined,
          description: operation.description as string | undefined,
          path: pathKey,
          method: method as HttpMethod,
          parameters: (operation.parameters as unknown[]) ?? [],
          requestBody: operation.requestBody,
          responses: (operation.responses as Record<string, unknown>) ?? {},
          tags: (operation.tags as string[]) ?? []
        });
      }
    }

    const spec: OpenApiSpec = {
      title: api.info?.title ?? 'Untitled API',
      version: api.info?.version ?? 'unknown',
      operations,
      findOperation: (method, pathKey) =>
        operations.find((op) => op.method === method && op.path === pathKey),
      findOperationById: (operationId) =>
        operations.find((op) => op.operationId === operationId),
      resolveRef: (ref) => resolveRefIn(api, ref)
    };

    this.cached.set(resolvedPath, spec);
    return spec;
  }

  async loadFromUrl(url: string): Promise<OpenApiSpec> {
    const api = (await SwaggerParser.parse(url)) as unknown as ParsedSpec;
    const operations: OperationSpec[] = [];

    for (const [pathKey, pathItem] of Object.entries(api.paths ?? {})) {
      for (const [method, rawOperation] of Object.entries(pathItem ?? {})) {
        if (!isHttpMethod(method)) continue;
        const operation = rawOperation as Record<string, unknown>;
        operations.push({
          operationId: operation.operationId as string | undefined,
          summary: operation.summary as string | undefined,
          description: operation.description as string | undefined,
          path: pathKey,
          method: method as HttpMethod,
          parameters: (operation.parameters as unknown[]) ?? [],
          requestBody: operation.requestBody,
          responses: (operation.responses as Record<string, unknown>) ?? {},
          tags: (operation.tags as string[]) ?? []
        });
      }
    }

    const spec: OpenApiSpec = {
      title: api.info?.title ?? 'Untitled API',
      version: api.info?.version ?? 'unknown',
      operations,
      findOperation: (method, pathKey) =>
        operations.find((op) => op.method === method && op.path === pathKey),
      findOperationById: (operationId) =>
        operations.find((op) => op.operationId === operationId),
      resolveRef: (ref) => resolveRefIn(api, ref)
    };

    return spec;
  }
}

export function createSpecLoader(): SpecLoader {
  return new SpecLoader();
}

function isHttpMethod(method: string): method is HttpMethod {
  return ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase());
}

function resolveRefIn(api: ParsedSpec, ref: string): unknown {
  if (!ref.startsWith('#/')) return ref;
  const parts = ref.slice(2).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current: unknown = api as unknown as Record<string, unknown>;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export function extractSchemaFromResponse(response: Record<string, unknown>, statusCode = '200'): unknown {
  const statusEntry = response[statusCode] ?? response['2XX'] ?? response.default;
  if (!statusEntry || typeof statusEntry !== 'object') return undefined;
  const entry = statusEntry as Record<string, unknown>;
  const content = entry.content as Record<string, unknown> | undefined;
  if (!content) return entry.schema ?? entry;
  for (const mediaType of ['application/json', '*/*']) {
    const schema = content[mediaType];
    if (schema) {
      const schemaObj = schema as Record<string, unknown>;
      return schemaObj.schema ?? schemaObj;
    }
  }
  return undefined;
}

export function extractSchemaFromRequestBody(requestBody: unknown): unknown {
  if (!requestBody || typeof requestBody !== 'object') return undefined;
  const body = requestBody as Record<string, unknown>;
  const content = body.content as Record<string, unknown> | undefined;
  if (!content) return body.schema ?? undefined;
  for (const mediaType of ['application/json', '*/*']) {
    const schema = content[mediaType];
    if (schema) {
      const schemaObj = schema as Record<string, unknown>;
      return schemaObj.schema ?? schemaObj;
    }
  }
  return undefined;
}