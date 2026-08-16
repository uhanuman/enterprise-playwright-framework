const SENSITIVE_PATTERNS = [
  /("password"\s*:\s*")([^"]+)(")/gi,
  /("token"\s*:\s*")([^"]+)(")/gi,
  /("apiKey"\s*:\s*")([^"]+)(")/gi,
  /("secret"\s*:\s*")([^"]+)(")/gi,
  /(Authorization:\s*Bearer\s+)(\S+)/gi,
  /(password=)([^\s&]+)/gi
];

export function redactString(input: string): string {
  let result = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (_match, prefix, _value, suffix) => {
      if (suffix) return `${prefix}***REDACTED***${suffix}`;
      return `${prefix}***REDACTED***`;
    });
  }
  return result;
}

export function redactValue(value: unknown): unknown {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (/password|secret|token|apikey|authorization/i.test(key)) {
        result[key] = '***REDACTED***';
      } else {
        result[key] = redactValue(val);
      }
    }
    return result;
  }
  return value;
}
