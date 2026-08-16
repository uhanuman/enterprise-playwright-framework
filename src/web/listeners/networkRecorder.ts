import type { Page, Request, Response } from '@playwright/test';

export interface NetworkCapture {
  url: string;
  method: string;
  status: number | null;
  statusText: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
  contentType: string;
  timingMs: number;
  startedAt: string;
}

export interface NetworkRecorderOptions {
  enabled?: boolean;
  filter?: (request: Request) => boolean;
  captureBodies?: boolean;
  captureFailure?: boolean;
  maxBodyLength?: number;
  onCapture?: (capture: NetworkCapture) => void;
}

export interface NetworkRecorder {
  start(): void;
  stop(): Promise<NetworkCapture[]>;
  getCaptures(): NetworkCapture[];
  toCurl(capture: NetworkCapture): string;
  toFetchSnippet(capture: NetworkCapture): string;
  toJson(): string;
}

export class NetworkRecorderImpl implements NetworkRecorder {
  private captures: NetworkCapture[] = [];
  private started = false;
  private readonly options: Required<Pick<NetworkRecorderOptions, 'enabled' | 'captureBodies' | 'captureFailure' | 'maxBodyLength'>> & NetworkRecorderOptions;

  constructor(private page: Page, options: NetworkRecorderOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      filter: options.filter,
      captureBodies: options.captureBodies ?? true,
      captureFailure: options.captureFailure ?? true,
      maxBodyLength: options.maxBodyLength ?? 500_000,
      onCapture: options.onCapture
    };
  }

  start(): void {
    if (!this.options.enabled || this.started) return;
    this.started = true;
    this.page.on('request', this.handleRequest);
    this.page.on('response', this.handleResponse);
    this.page.on('requestfailed', this.handleRequestFailed);
  }

  stop(): Promise<NetworkCapture[]> {
    if (this.started) {
      this.page.off('request', this.handleRequest);
      this.page.off('response', this.handleResponse);
      this.page.off('requestfailed', this.handleRequestFailed);
      this.started = false;
    }
    return Promise.resolve([...this.captures]);
  }

  getCaptures(): NetworkCapture[] {
    return [...this.captures];
  }

  toJson(): string {
    return JSON.stringify(this.captures, null, 2);
  }

  toCurl(capture: NetworkCapture): string {
    const headers = Object.entries(capture.requestHeaders)
      .map(([key, value]) => `-H '${key}: ${value}'`)
      .join(' ');
    const body = capture.requestBody
      ? `-d '${typeof capture.requestBody === 'string' ? capture.requestBody : JSON.stringify(capture.requestBody)}'`
      : '';
    return `curl -X ${capture.method} '${capture.url}' ${headers} ${body}`.trim();
  }

  toFetchSnippet(capture: NetworkCapture): string {
    const body = capture.requestBody !== undefined
      ? `body: ${JSON.stringify(capture.requestBody, null, 2)}`
      : '';
    return `fetch('${capture.url}', {\n  method: '${capture.method}',\n  headers: ${JSON.stringify(capture.requestHeaders, null, 2)}${body ? `,\n  ${body}` : ''}\n});`;
  }

  private readonly handleRequest = (request: Request): void => {
    if (!this.shouldCapture(request)) return;
    const entry = this.findEntry(request.url());
    if (entry) {
      entry.requestHeaders = request.headers();
      entry.requestBody = this.readRequestBody(request);
    }
  };

  private readonly handleResponse = (response: Response): void => {
    const request = response.request();
    if (!this.shouldCapture(request)) return;
    const entry = this.findEntry(request.url());
    if (!entry) return;
    entry.status = response.status();
    entry.statusText = response.statusText();
    entry.responseHeaders = response.headers();
    entry.contentType = response.headers()['content-type'] ?? '';
    entry.timingMs = Date.now() - new Date(entry.startedAt).getTime();

    if (this.options.captureBodies) {
      response.body().then((body) => {
        const text = body.toString('utf8');
        const responseHeaders = response.headers();
        const contentType = responseHeaders['content-type'] ?? '';
        entry.responseBody = this.truncate(this.tryParseJson(text, contentType));
        this.options.onCapture?.(entry);
      }).catch(() => {
        entry.responseBody = undefined;
      });
    }
  };

  private readonly handleRequestFailed = (request: Request): void => {
    if (!this.options.captureFailure || !this.shouldCapture(request)) return;
    const entry = this.findEntry(request.url());
    if (entry) {
      entry.status = null;
      this.options.onCapture?.(entry);
    }
  };

  private shouldCapture(request: Request): boolean {
    if (!this.options.enabled) return false;
    if (this.options.filter) return this.options.filter(request);
    return true;
  }

  private findEntry(url: string): NetworkCapture | undefined {
    return this.captures.find((c) => c.url === url);
  }

  private readRequestBody(request: Request): unknown {
    if (request.method() === 'GET' || !this.options.captureBodies) return undefined;
    const postData = request.postData();
    if (postData === null || postData === undefined) return undefined;
    try {
      return JSON.parse(postData);
    } catch {
      return this.truncate(postData);
    }
  }

  private tryParseJson(text: string, contentType: string): unknown {
    if (/json/i.test(contentType)) {
      try {
        return JSON.parse(text);
      } catch {
        return this.truncate(text);
      }
    }
    return this.truncate(text);
  }

  private truncate(value: unknown): unknown {
    if (typeof value === 'string' && value.length > this.options.maxBodyLength) {
      return `${value.slice(0, this.options.maxBodyLength)}... [truncated]`;
    }
    return value;
  }
}

export function createNetworkRecorder(page: Page, options: NetworkRecorderOptions = {}): NetworkRecorder {
  return new NetworkRecorderImpl(page, options);
}