import fs from 'node:fs';
import path from 'node:path';

export interface FrameworkEnv {
  OUTPUT_DIR: string;
  LOG_LEVEL: string;
  REDACT_SECRETS: boolean;
  ENVIRONMENT: string;
  WORKERS: number;
  ENABLE_AI: boolean;
  BASE_URL: string;
  API_BASE_URL: string;
  AI_API_KEY: string;
  AI_API_URL: string;
}

function parseEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return env;

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }
  return env;
}

export function loadEnv(envFile = '.env'): FrameworkEnv {
  const fileEnv = parseEnvFile(path.resolve(envFile));
  const get = (key: string, fallback = ''): string =>
    process.env[key] ?? fileEnv[key] ?? fallback;

  return {
    OUTPUT_DIR: get('OUTPUT_DIR', 'output'),
    LOG_LEVEL: get('LOG_LEVEL', 'info'),
    REDACT_SECRETS: get('REDACT_SECRETS', 'true') === 'true',
    ENVIRONMENT: get('ENVIRONMENT', 'dev'),
    WORKERS: Number(get('WORKERS', '4')),
    ENABLE_AI: get('ENABLE_AI', 'false') === 'true',
    BASE_URL: get('BASE_URL', 'http://localhost:3000'),
    API_BASE_URL: get('API_BASE_URL', 'http://localhost:8080/api'),
    AI_API_KEY: get('AI_API_KEY'),
    AI_API_URL: get('AI_API_URL')
  };
}
