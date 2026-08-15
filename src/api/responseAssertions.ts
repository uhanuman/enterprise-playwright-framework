import type { ApiResponse } from './apiClient.js';

export interface ResponseTimeOptions {
  maxMs: number;
  message?: string;
}

export interface RequiredFieldsOptions {
  required: string[];
  message?: string;
}

export interface ExpectedSchemaOptions {
  schema: unknown;
  validator?: (data: unknown, schema: unknown) => { valid: boolean; errors?: string[] };
}

export function expectStatus(response: ApiResponse, expected: number, message?: string): void {
  const actual = response.status();
  if (actual !== expected) {
    throw new Error(message ?? `Expected status ${expected}, got ${actual}`);
  }
}

export function expectSuccess(response: ApiResponse, allowedStatuses: number[] = [200, 201, 202, 204]): void {
  const actual = response.status();
  if (!allowedStatuses.includes(actual)) {
    throw new Error(`Expected success status in [${allowedStatuses.join(', ')}], got ${actual}`);
  }
}

export function expectResponseTime(response: ApiResponse, options: ResponseTimeOptions): void {
  const actual = response.timing();
  if (actual > options.maxMs) {
    throw new Error(
      options.message ?? `Response time ${actual}ms exceeded SLA of ${options.maxMs}ms`
    );
  }
}

export async function expectRequiredFields(
  response: ApiResponse,
  options: RequiredFieldsOptions
): Promise<void> {
  const body = await response.json();
  if (body === null || typeof body !== 'object') {
    throw new Error('Response body is not an object; cannot check required fields');
  }
  const record = body as Record<string, unknown>;
  const missing = options.required.filter((field) => !(field in record));
  if (missing.length > 0) {
    throw new Error(
      options.message ?? `Missing required fields in response: ${missing.join(', ')}`
    );
  }
}

export async function expectSchema(
  response: ApiResponse,
  options: ExpectedSchemaOptions
): Promise<void> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = await response.text();
  }
  if (options.validator) {
    const result = options.validator(body, options.schema);
    if (!result.valid) {
      throw new Error(`Schema validation failed:\n${(result.errors ?? []).join('\n')}`);
    }
    return;
  }
  const { validateJson } = await import('../utils/json/validate.js');
  const result = validateJson(options.schema, body);
  if (!result.valid) {
    throw new Error(`Schema validation failed:\n${result.prettyErrors.join('\n')}`);
  }
}

export async function expectErrorResponse(
  response: ApiResponse,
  expectedStatus: number,
  errorKey?: string
): Promise<void> {
  expectStatus(response, expectedStatus);
  if (!errorKey) return;
  const body = await response.json();
  if (body && typeof body === 'object' && !(errorKey in (body as Record<string, unknown>))) {
    throw new Error(`Expected error key '${errorKey}' in error response body`);
  }
}

export interface ResponseAssertions {
  status(response: ApiResponse, expected: number, message?: string): void;
  success(response: ApiResponse, allowedStatuses?: number[]): void;
  responseTime(response: ApiResponse, options: ResponseTimeOptions): void;
  requiredFields(response: ApiResponse, options: RequiredFieldsOptions): Promise<void>;
  schema(response: ApiResponse, options: ExpectedSchemaOptions): Promise<void>;
  error(response: ApiResponse, expectedStatus: number, errorKey?: string): Promise<void>;
}

export function createResponseAssertions(): ResponseAssertions {
  return {
    status: expectStatus,
    success: expectSuccess,
    responseTime: expectResponseTime,
    requiredFields: expectRequiredFields,
    schema: expectSchema,
    error: expectErrorResponse
  };
}