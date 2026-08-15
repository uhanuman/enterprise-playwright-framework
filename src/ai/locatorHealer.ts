import type { Page, Locator } from '@playwright/test';
import { AiProvider, isAiEnabled, createAiProvider, AiProviderConfig } from './provider.js';

export interface HealSuggestion {
  originalSelector: string;
  suggestedSelectors: string[];
  confidence?: number;
  reason?: string;
}

export interface LocatorHealOptions {
  page?: Page;
  candidateSelectors?: string[];
  provider?: AiProvider;
}

export interface LocatorHealer {
  heal(failedSelector: string, options?: LocatorHealOptions): Promise<HealSuggestion | null>;
}

export class AiLocatorHealer implements LocatorHealer {
  async heal(failedSelector: string, options: LocatorHealOptions = {}): Promise<HealSuggestion | null> {
    if (!isAiEnabled()) return null;

    const candidates = options.candidateSelectors ?? [];
    try {
      const provider = options.provider ?? createAiProvider(loadAiConfig());
      const candidateBlock = candidates.length
        ? `\nCandidate selectors to try:\n${candidates.join('\n')}`
        : '';

      const content = await provider.complete([
        {
          role: 'system',
          content: 'You are a Playwright locator healing assistant. Suggest alternative CSS/XPath selectors.'
        },
        {
          role: 'user',
          content:
            `The selector '${failedSelector}' failed to match any element. ` +
            `Suggest up to 3 alternative selectors. Return ONLY a JSON object of the form ` +
            `{"suggestedSelectors": [...], "confidence": number, "reason": "..."}.\n${candidateBlock}`
        }
      ]);

      const parsed = JSON.parse(extractJsonObject(content)) as {
        suggestedSelectors?: string[];
        confidence?: number;
        reason?: string;
      };

      return {
        originalSelector: failedSelector,
        suggestedSelectors: parsed.suggestedSelectors ?? [],
        confidence: parsed.confidence,
        reason: parsed.reason
      };
    } catch (error) {
      console.warn(`Locator healing failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async suggestAlternatives(failedSelector: string, page?: Page): Promise<HealSuggestion | null> {
    const candidates = page ? await collectCandidates(page, failedSelector) : [];
    return this.heal(failedSelector, { page, candidateSelectors: candidates });
  }
}

async function collectCandidates(page: Page, failedSelector: string): Promise<string[]> {
  const candidates: string[] = [];
  try {
    const locator: Locator = page.locator(failedSelector);
    const count = await locator.count();
    if (count > 0) {
      candidates.push(`original selector matched ${count} element(s) but interaction timed out`);
    }
  } catch {
    // original failed; continue
  }
  return candidates;
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

export function createLocatorHealer(): LocatorHealer {
  return new AiLocatorHealer();
}