import { AiProvider, isAiEnabled, createAiProvider, AiProviderConfig } from './provider.js';

export interface GenerateOptions {
  schema?: unknown;
  description?: string;
  count?: number;
  provider?: AiProvider;
}

export interface TestDataGenerator {
  generateTestData(options: GenerateOptions): Promise<Record<string, unknown>[]>;
}

export class AiTestDataGenerator implements TestDataGenerator {
  async generateTestData(options: GenerateOptions): Promise<Record<string, unknown>[]> {
    if (!isAiEnabled()) {
      return fallbackGenerate(options);
    }
    try {
      const provider = options.provider ?? createAiProvider(loadAiConfig());
      const count = options.count ?? 1;
      const schemaBlock = options.schema ? `\nJSON Schema:\n${JSON.stringify(options.schema, null, 2)}` : '';
      const descriptionBlock = options.description ? `\nDescription: ${options.description}` : '';

      const prompt =
        `Generate ${count} JSON test data object(s) conforming to the constraints below. ` +
        `Return ONLY a valid JSON array of objects, no prose.\n${schemaBlock}${descriptionBlock}`;

      const content = await provider.complete([
        { role: 'system', content: 'You generate realistic test data as JSON arrays.' },
        { role: 'user', content: prompt }
      ]);

      const parsed = parseJsonArray(content);
      return parsed;
    } catch (error) {
      console.warn(`AI test data generation failed, using fallback: ${error instanceof Error ? error.message : String(error)}`);
      return fallbackGenerate(options);
    }
  }

  async generate(dataDescription: string, count?: number): Promise<Record<string, unknown>[]> {
    return this.generateTestData({ description: dataDescription, count });
  }
}

function fallbackGenerate(options: GenerateOptions): Record<string, unknown>[] {
  const count = options.count ?? 1;
  const schema = options.schema as Record<string, unknown> | undefined;
  const properties = (schema?.properties as Record<string, unknown>) ?? {};
  const records: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const record: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
      record[key] = sampleValue(value as Record<string, unknown>, i);
    }
    records.push(record);
  }
  return records;
}

function sampleValue(schema: Record<string, unknown>, index: number): unknown {
  const type = schema.type as string | undefined;
  switch (type) {
    case 'integer':
    case 'number':
      return index;
    case 'boolean':
      return index % 2 === 0;
    case 'string':
      return schema.format === 'date' ? `2026-01-${String(index + 1).padStart(2, '0')}` : `test-${index}`;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}

function parseJsonArray(content: string): Record<string, unknown>[] {
  const trimmed = content.trim();
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('AI response did not contain a JSON array');
  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>[];
}

function loadAiConfig(): AiProviderConfig {
  return {
    apiKey: process.env.AI_API_KEY ?? '',
    apiUrl: process.env.AI_API_URL ?? '',
    model: process.env.AI_MODEL ?? 'gpt-4o-mini'
  };
}

export function createTestDataGenerator(): TestDataGenerator {
  return new AiTestDataGenerator();
}