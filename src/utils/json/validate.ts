import { Ajv, ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

const applyFormats = addFormats as unknown as (ajv: Ajv, opts?: Record<string, unknown>) => Ajv;

let ajvInstance: Ajv | null = null;

export interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[] | null;
  prettyErrors: string[];
}

function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = applyFormats(new Ajv({ allErrors: true, strict: false }), {
      mode: 'fast',
      formats: ['date', 'date-time', 'email', 'uuid', 'uri', 'ipv4', 'ipv6', 'hostname', 'regex', 'time']
    });
  }
  return ajvInstance;
}

export function compileSchema(schema: unknown): ValidateFunction {
  return getAjv().compile(schema as never);
}

export function validateJson(schema: unknown, data: unknown): ValidationResult {
  const validate = compileSchema(schema);
  const valid = validate(data);
  const errors = validate.errors ?? null;
  return {
    valid,
    errors,
    prettyErrors: errors ? errors.map((err) => `${err.instancePath || '/'} ${err.message}`) : []
  };
}

export function validateAgainstSchema(schema: unknown, data: unknown): boolean {
  return validateJson(schema, data).valid;
}

export function addSchema(schema: unknown, key: string): void {
  getAjv().addSchema(schema as never, key);
}

export function hasSchema(key: string): boolean {
  return getAjv().getSchema(key) !== undefined;
}

export function formatValidationErrors(errors: ErrorObject[] | null): string[] {
  if (!errors) return [];
  return errors.map((err) => `${err.instancePath || '/'} ${err.message ?? 'invalid'}`);
}