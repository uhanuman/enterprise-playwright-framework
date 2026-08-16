import { AiProvider, isAiEnabled, createAiProvider, AiProviderConfig } from './provider.js';

export interface MockResponseOptions {
  schema?: unknown;
  examples?: Record<string, unknown>[];
  description?: string;
  status?: number;
  provider?: AiProvider;
}

export interface MockResponseBuilder {
  buildResponse(options: MockResponseOptions): Promise<unknown>;
}

export class AiMockResponseBuilder implements MockResponseBuilder {
  async buildResponse(options: MockResponseOptions): Promise<unknown> {
    if (options.examples && options.examples.length > 0) {
      return options.examples[0];
    }
    if (!isAiEnabled()) {
      return fallbackMock(options.schema);
    }
    try {
      const provider = options.provider ?? createAiProvider(loadAiConfig());
      const schemaBlock = options.schema ? `\nJSON Schema:\n${JSON.stringify(options.schema, null, 2)}` : '';
      const descriptionBlock = options.description ? `\nDescription: ${options.description}` : '';
      const content = await provider.complete([
        {
          role: 'system',
          content: 'You generate realistic mock API responses. Return ONLY valid JSON, no prose.'
        },
        {
          role: 'user',
          content: `Generate one mock API response conforming to the schema.${schemaBlock}${descriptionBlock}`
        }
      ]);
      return parseJson(content);
    } catch (error) {
      console.warn(`AI mock response generation failed, using fallback: ${error instanceof Error ? error.message : String(error)}`);
      return fallbackMock(options.schema);
    }
  }

  async createMock(schema: unknown): Promise<unknown> {
    return this.buildResponse({ schema });
  }
}

function fallbackMock(schema: unknown): unknown {
  const schemaObj = schema as Record<string, unknown> | undefined;
  if (schemaObj?.example !== undefined) return schemaObj.example;
  const properties = (schemaObj?.properties as Record<string, unknown>) ?? {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    const prop = value as Record<string, unknown>;
    if (prop.example !== undefined) {
      result[key] = prop.example;
    } else if (Array.isArray(prop.enum) && prop.enum.length > 0) {
      result[key] = prop.enum[0];
    } else if (prop.default !== undefined) {
      result[key] = prop.default;
    } else {
      result[key] = mockPrimitive(prop);
    }
  }
  return result;
}

function mockPrimitive(schema: Record<string, unknown>): unknown {
  switch (schema.type) {
    case 'integer':
    case 'number':
      return schema.minimum !== undefined ? schema.minimum : 1;
    case 'boolean':
      return true;
    case 'string':
      return schema.format === 'date' ? '2026-01-01' : 'mock-value';
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return 'mock-value';
  }
}

function parseJson(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('AI response did not contain valid JSON');
  }
}

function loadAiConfig(): AiProviderConfig {
  return {
    apiKey: process.env.AI_API_KEY ?? '',
    apiUrl: process.env.AI_API_URL ?? '',
    model: process.env.AI_MODEL ?? 'gpt-4o-mini'
  };
}

export function createMockResponseBuilder(): MockResponseBuilder {
  return new AiMockResponseBuilder();
}