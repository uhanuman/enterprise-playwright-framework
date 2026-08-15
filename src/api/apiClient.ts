import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { HttpMethod, OpenApiSpec } from './specLoader.js';

export interface ApiClientOptions {
  baseURL: string;
  request: APIRequestContext;
  defaultHeaders?: Record<string, string>;
  spec?: OpenApiSpec;
  timeout?: number;
  ignoreHttpErrors?: boolean;
}

export interface ApiRequestConfig {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  pathParams?: Record<string, string | number>;
}

export interface ApiResponse {
  status(): number;
  ok(): boolean;
  text(): Promise<string>;
  json(): Promise<unknown>;
  body(): Promise<Buffer>;
  headers(): Record<string, string>;
  timing(): number;
  url(): string;
  raw(): APIResponse;
}

export class ApiClient {
  private readonly options: Required<Pick<ApiClientOptions, 'baseURL' | 'request' | 'defaultHeaders' | 'ignoreHttpErrors'>> & ApiClientOptions;

  constructor(options: ApiClientOptions) {
    this.options = {
      baseURL: options.baseURL,
      request: options.request,
      defaultHeaders: options.defaultHeaders ?? {},
      ignoreHttpErrors: options.ignoreHttpErrors ?? false,
      spec: options.spec,
      timeout: options.timeout
    };
  }

  operation(operationId: string): ApiOperationBuilder {
    const spec = this.options.spec;
    if (!spec) {
      throw new Error('No OpenAPI spec loaded; cannot use operation() lookup');
    }
    const operation = spec.findOperationById(operationId);
    if (!operation) {
      throw new Error(`Operation not found in spec: ${operationId}`);
    }
    return new ApiOperationBuilder(this, operation.method, operation.path);
  }

  path(method: HttpMethod, url: string): ApiOperationBuilder {
    return new ApiOperationBuilder(this, method, url);
  }

  async send(config: ApiRequestConfig): Promise<ApiResponse> {
    const startedAt = Date.now();
    const url = this.buildUrl(config.url, config.pathParams);
    const queryParams = config.params;

    const response = await this.options.request.fetch(url, {
      method: config.method.toUpperCase(),
      headers: { ...this.options.defaultHeaders, ...config.headers },
      data: config.data,
      params: queryParams as Record<string, string | number | boolean>,
      timeout: this.options.timeout,
      ignoreHTTPSErrors: true
    });

    const timing = Date.now() - startedAt;
    return createApiResponse(response, timing);
  }

  private buildUrl(url: string, pathParams?: Record<string, string | number>): string {
    let finalUrl = url;
    if (pathParams) {
      for (const [key, value] of Object.entries(pathParams)) {
        finalUrl = finalUrl.replace(`{${key}}`, String(value));
      }
    }
    if (/^https?:\/\//i.test(finalUrl)) return finalUrl;
    const base = this.options.baseURL.replace(/\/$/, '');
    return `${base}/${finalUrl.replace(/^\//, '')}`;
  }

  get baseURL(): string {
    return this.options.baseURL;
  }
}

export class ApiOperationBuilder {
  private headers: Record<string, string> = {};
  private data: unknown;
  private params: Record<string, string | number | boolean | undefined> = {};
  private pathParams: Record<string, string | number> = {};

  constructor(
    private readonly client: ApiClient,
    private readonly method: HttpMethod,
    private readonly url: string
  ) {}

  withHeaders(headers: Record<string, string>): this {
    this.headers = { ...this.headers, ...headers };
    return this;
  }

  withBody(body: unknown): this {
    this.data = body;
    return this;
  }

  withQuery(params: Record<string, string | number | boolean | undefined>): this {
    this.params = { ...this.params, ...params };
    return this;
  }

  withPathParams(params: Record<string, string | number>): this {
    this.pathParams = { ...this.pathParams, ...params };
    return this;
  }

  send(): Promise<ApiResponse> {
    return this.client.send({
      method: this.method,
      url: this.url,
      headers: this.headers,
      data: this.data,
      params: this.params,
      pathParams: this.pathParams
    });
  }
}

export function createApiClient(request: APIRequestContext, options: Omit<ApiClientOptions, 'request'>): ApiClient {
  return new ApiClient({ ...options, request });
}

function createApiResponse(response: APIResponse, timing: number): ApiResponse {
  return {
    status: () => response.status(),
    ok: () => response.ok(),
    text: () => response.text(),
    json: () => response.json(),
    body: () => response.body(),
    headers: () => response.headers(),
    timing: () => timing,
    url: () => response.url(),
    raw: () => response
  };
}