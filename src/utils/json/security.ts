const SENSITIVE_KEY_PATTERN = /password|secret|token|apikey|api_key|authorization|auth|credential|cookie/i;

const SENSITIVE_VALUE_PATTERN = /Bearer\s+\S+|password\s*[:=]\s*\S+|secret\s*[:=]\s*\S+|api[_-]?key\s*[:=]\s*\S+/i;

const REDACTED = '***REDACTED***';

export interface RedactionOptions {
  sensitiveKeys?: string[];
  replaceWith?: string;
  maskMode?: 'full' | 'partial';
}

export function redactField(name: string, value: unknown, options: RedactionOptions = {}): unknown {
  const { sensitiveKeys = [], replaceWith = REDACTED } = options;
  const keyPattern = sensitiveKeys.length
    ? new RegExp(sensitiveKeys.map(escapeRegExp).join('|'), 'i')
    : SENSITIVE_KEY_PATTERN;

  if (keyPattern.test(name)) return replaceWith;
  if (typeof value === 'string' && SENSITIVE_VALUE_PATTERN.test(value)) return replaceWith;
  return value;
}

export function redactDeep(input: unknown, options: RedactionOptions = {}): unknown {
  if (Array.isArray(input)) return input.map((item) => redactDeep(item, options));
  if (input && typeof input === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const redacted = redactField(key, value, options);
      result[key] = typeof redacted === 'object' && redacted !== null
        ? redactDeep(redacted, options)
        : redacted;
    }
    return result;
  }
  return input;
}

export function redactStringInText(input: string, options: RedactionOptions = {}): string {
  const { replaceWith = REDACTED } = options;
  return input
    .replace(/(Bearer\s+)\S+/gi, `$1${replaceWith}`)
    .replace(/(password\s*[:=]\s*)\S+/gi, `$1${replaceWith}`)
    .replace(/(secret\s*[:=]\s*)\S+/gi, `$1${replaceWith}`)
    .replace(/(api[_-]?key\s*[:=]\s*)\S+/gi, `$1${replaceWith}`);
}

export function sanitizeForLogs(input: unknown, options: RedactionOptions = {}): unknown {
  return redactDeep(input, options);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}