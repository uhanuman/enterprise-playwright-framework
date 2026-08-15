import { AiProvider, isAiEnabled, createAiProvider, AiProviderConfig } from './provider.js';

export interface ScriptSuggestion {
  steps: string[];
  explanation?: string;
}

export interface ScriptSuggester {
  suggestSteps(description: string, options?: { provider?: AiProvider }): Promise<ScriptSuggestion | null>;
}

export class AiScriptSuggester implements ScriptSuggester {
  async suggestSteps(description: string, options: { provider?: AiProvider } = {}): Promise<ScriptSuggestion | null> {
    if (!isAiEnabled()) return null;
    try {
      const provider = options.provider ?? createAiProvider(loadAiConfig());
      const content = await provider.complete([
        {
          role: 'system',
          content:
            'You are a Playwright test authoring assistant. Suggest structured test steps ' +
            'using the ActionBuilder vocabulary (navigate, fill, click, selectOption, check, ' +
            'assertVisible, waitForSelector, screenshot).'
        },
        {
          role: 'user',
          content:
            `Suggest Playwright test steps for the following scenario: "${description}". ` +
            `Return ONLY a JSON object of the form {"steps": [...], "explanation": "..."}.`
        }
      ]);
      const parsed = JSON.parse(extractJsonObject(content)) as { steps?: string[]; explanation?: string };
      return {
        steps: parsed.steps ?? [],
        explanation: parsed.explanation
      };
    } catch (error) {
      console.warn(`Script suggestion failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}

function extractJsonObject(content: string): string {
  const trimmed = content.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI response did not contain a JSON object');
  return trimmed.slice(start, end + 1);
}

function loadAiConfig(): AiProviderConfig {
  return {
    apiKey: process.env.AI_API_KEY ?? '',
    apiUrl: process.env.AI_API_URL ?? '',
    model: process.env.AI_MODEL ?? 'gpt-4o-mini'
  };
}

export function createScriptSuggester(): ScriptSuggester {
  return new AiScriptSuggester();
}