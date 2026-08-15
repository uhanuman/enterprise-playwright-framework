import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from './env.js';

export interface FrameworkConfig {
  outputDir: string;
  logLevel: string;
  redactSecrets: boolean;
  environment: string;
  workers: number;
  enableAi: boolean;
  baseUrl: string;
  apiBaseUrl: string;
  timeout: number;
  expectTimeout: number;
  retries: number;
  trace: string;
  screenshot: string;
  networkRecording: boolean;
  quality: {
    lighthouseMinScore: number;
    axeMaxViolations: number;
  };
  [key: string]: unknown;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content) as T;
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof result[key] === 'object') {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function createFrameworkConfig(rootDir = process.cwd()): Promise<FrameworkConfig> {
  const env = loadEnv();
  const configDir = path.join(rootDir, 'config');

  const defaults = await readJsonFile<Record<string, unknown>>(path.join(configDir, 'defaults.json'));
  const envFile = path.join(configDir, 'environments', `${env.ENVIRONMENT}.json`);
  let envConfig: Record<string, unknown> = {};
  try {
    envConfig = await readJsonFile<Record<string, unknown>>(envFile);
  } catch {
    // environment file optional
  }

  const merged = deepMerge(defaults, envConfig);

  return {
    ...merged,
    outputDir: path.resolve(env.OUTPUT_DIR),
    logLevel: env.LOG_LEVEL,
    redactSecrets: env.REDACT_SECRETS,
    environment: env.ENVIRONMENT,
    workers: env.WORKERS,
    enableAi: env.ENABLE_AI,
    baseUrl: env.BASE_URL || (merged.baseUrl as string) || 'http://localhost:3000',
    apiBaseUrl: env.API_BASE_URL || (merged.apiBaseUrl as string) || 'http://localhost:8080/api',
    timeout: (merged.timeout as number) ?? 30000,
    expectTimeout: (merged.expectTimeout as number) ?? 10000,
    retries: (merged.retries as number) ?? 1,
    trace: (merged.trace as string) ?? 'on-first-retry',
    screenshot: (merged.screenshot as string) ?? 'only-on-failure',
    networkRecording: (merged.networkRecording as boolean) ?? true,
    quality: (merged.quality as FrameworkConfig['quality']) ?? { lighthouseMinScore: 50, axeMaxViolations: 0 }
  };
}

export interface RuntimeDataStore {
  [environment: string]: Record<string, Record<string, unknown>>;
}

export class RuntimeStore {
  private store: RuntimeDataStore = {};
  private environment: string;

  constructor(environment: string) {
    this.environment = environment;
  }

  async load(rootDir = process.cwd()): Promise<void> {
    const storePath = path.join(rootDir, 'config', 'runTimeDataStore.json');
    try {
      this.store = await readJsonFile<RuntimeDataStore>(storePath);
    } catch {
      this.store = {};
    }
  }

  get(pathKey: string): unknown {
    const envStore = this.store[this.environment] ?? {};
    const parts = pathKey.split('.');
    let current: unknown = envStore;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  getFlat(key: string): unknown {
    const envStore = this.store[this.environment] ?? {};
    for (const namespace of Object.values(envStore)) {
      if (namespace && typeof namespace === 'object' && key in namespace) {
        return (namespace as Record<string, unknown>)[key];
      }
    }
    return undefined;
  }

  set(namespace: string, key: string, value: unknown): void {
    if (!this.store[this.environment]) {
      this.store[this.environment] = {};
    }
    if (!this.store[this.environment][namespace]) {
      this.store[this.environment][namespace] = {};
    }
    (this.store[this.environment][namespace] as Record<string, unknown>)[key] = value;
  }

  setPath(pathKey: string, value: unknown): void {
    const parts = pathKey.split('.');
    const namespace = parts[0];
    const key = parts.slice(1).join('.');
    if (key) {
      this.set(namespace, key, value);
    } else {
      if (!this.store[this.environment]) this.store[this.environment] = {};
      this.store[this.environment][namespace] = value as Record<string, unknown>;
    }
  }

  getEnvStore(): Record<string, Record<string, unknown>> {
    return this.store[this.environment] ?? {};
  }
}
