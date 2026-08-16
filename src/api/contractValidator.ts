import { validateJson } from '../utils/json/validate.js';
import { diffJson } from '../utils/json/patch.js';
import { compileSchema } from '../utils/json/validate.js';
import type { ApiResponse } from './apiClient.js';

export interface ContractValidationResult {
  valid: boolean;
  statusCode: number;
  schemaStatus: boolean;
  errors: string[];
  diff?: unknown;
  responseSummary: string;
}

export class ContractValidator {
  async validateResponse(response: ApiResponse, schema: unknown): Promise<ContractValidationResult> {
    return this.validate(response, schema);
  }

  async validate(response: ApiResponse, schema: unknown): Promise<ContractValidationResult> {
    let body: unknown;
    let bodyText = '';
    try {
      bodyText = await response.text();
      body = bodyText ? JSON.parse(bodyText) : undefined;
    } catch {
      body = bodyText;
    }

    const result = validateJson(schema, body);
    const diff = result.valid ? undefined : this.computeDiff(schema, body);

    return {
      valid: result.valid,
      statusCode: response.status(),
      schemaStatus: result.valid,
      errors: result.prettyErrors,
      diff,
      responseSummary: this.summarize(response.status(), body)
    };
  }

  async assertValid(response: ApiResponse, schema: unknown): Promise<ContractValidationResult> {
    const result = await this.validateResponse(response, schema);
    if (!result.valid) {
      throw new Error(
        `Contract validation failed for ${response.status()}:\n${result.errors.join('\n')}\n` +
        `Diff: ${JSON.stringify(result.diff, null, 2)}`
      );
    }
    return result;
  }

  getValidator(schema: unknown) {
    return compileSchema(schema);
  }

  private computeDiff(schema: unknown, body: unknown): unknown {
    try {
      const example = (schema as Record<string, unknown> | undefined)?.example;
      if (example === undefined) return undefined;
      return diffJson(example, body);
    } catch {
      return undefined;
    }
  }

  private summarize(status: number, body: unknown): string {
    if (body === undefined) return `${status} (no body)`;
    if (typeof body === 'object') return `${status} ${JSON.stringify(body).slice(0, 200)}`;
    return `${status} ${String(body).slice(0, 200)}`;
  }
}

export function createContractValidator(): ContractValidator {
  return new ContractValidator();
}