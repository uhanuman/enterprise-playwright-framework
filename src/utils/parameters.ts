import { addDays, addMonths, format } from 'date-fns';
import type { FrameworkConfig } from '../config/manager.js';

export interface ParameterContext {
  environment: string;
  runId?: string;
  testName?: string;
  runtimeGet?: (pathKey: string) => unknown;
  envVars?: Record<string, string | undefined>;
  config?: Record<string, unknown>;
}

export type ResolveValue = string | number | boolean | null | Record<string, unknown> | unknown[];

const TOKEN_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

function resolveDateToken(token: string, now = new Date()): string {
  const body = token.trim();
  if (body === 'TODAY') return format(now, 'yyyy-MM-dd');
  const todayMatch = body.match(/^TODAY([+-]\d+)$/);
  if (todayMatch) return format(addDays(now, Number(todayMatch[1])), 'yyyy-MM-dd');
  if (body === 'NOW') return now.toISOString();
  if (body === 'NEXT_MONTH') return format(addMonths(now, 1), 'yyyy-MM-dd');
  const dateMatch = body.match(/^DATE:([^:]+):([+-]?\d+)$/);
  if (dateMatch) return format(addDays(now, Number(dateMatch[2])), dateMatch[1]);
  const monthMatch = body.match(/^MONTH:([^:]+):([+-]?\d+)$/);
  if (monthMatch) return format(addMonths(now, Number(monthMatch[2])), monthMatch[1]);
  return `{{${token}}}`;
}

export function resolveToken(token: string, context: ParameterContext, now = new Date()): unknown {
  const body = token.trim();

  if (body.startsWith('DATE:') || body === 'TODAY' || /^TODAY[+-]\d+$/.test(body) || body === 'NOW' || body === 'NEXT_MONTH' || body.startsWith('MONTH:')) {
    return resolveDateToken(body, now);
  }

  if (body.startsWith('ENV.')) {
    const envKey = body.slice(4);
    return context.envVars?.[envKey] ?? process.env[envKey] ?? undefined;
  }

  if (body.startsWith('ENVIRONMENT')) return context.environment;

  if (body === 'RUN_ID') return context.runId ?? '';
  if (body === 'TEST_NAME') return context.testName ?? '';

  if (body.startsWith('RUNTIME.')) {
    const pathKey = body.slice('RUNTIME.'.length);
    return context.runtimeGet ? context.runtimeGet(pathKey) : undefined;
  }

  if (body.startsWith('CONFIG.')) {
    const configKey = body.slice('CONFIG.'.length);
    return context.config?.[configKey];
  }

  if (context.runtimeGet) {
    const runtimeValue = context.runtimeGet(body);
    if (runtimeValue !== undefined) return runtimeValue;
  }

  return `{{${token}}}`;
}

export function resolveString(value: string, context: ParameterContext, now = new Date()): string {
  return value.replace(TOKEN_PATTERN, (fullMatch, token: string) => {
    const resolved = resolveToken(token, context, now);
    return resolved === undefined || resolved === null ? '' : String(resolved);
  });
}

export function resolveValue(value: ResolveValue, context: ParameterContext, now = new Date()): ResolveValue {
  if (typeof value === 'string') {
    return resolveString(value, context, now);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item as ResolveValue, context, now));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = resolveValue(val as ResolveValue, context, now);
    }
    return result;
  }
  return value;
}

export function hasTokens(value: unknown): boolean {
  if (typeof value === 'string') return TOKEN_PATTERN.test(value);
  if (Array.isArray(value)) return value.some(hasTokens);
  if (value && typeof value === 'object') return Object.values(value).some(hasTokens);
  return false;
}

export interface ParameterEngine {
  resolve: (value: ResolveValue) => ResolveValue;
  resolveString: (value: string) => string;
  context: ParameterContext;
}

export function createParameterEngine(config: FrameworkConfig, overrides: Partial<ParameterContext> = {}): ParameterEngine {
  const context: ParameterContext = {
    environment: config.environment,
    runId: overrides.runId,
    testName: overrides.testName,
    runtimeGet: overrides.runtimeGet,
    envVars: overrides.envVars ?? {
      BASE_URL: config.baseUrl,
      API_BASE_URL: config.apiBaseUrl,
      ENVIRONMENT: config.environment,
      OUTPUT_DIR: config.outputDir
    },
    config: config as unknown as Record<string, unknown>,
    ...overrides
  };

  return {
    context,
    resolve: (value) => resolveValue(value, context),
    resolveString: (value) => resolveString(value, context)
  };
}