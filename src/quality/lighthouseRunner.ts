import type { Page } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';

export interface LighthouseResult {
  url: string;
  scores: Record<string, number>;
  timestamp: string;
  comparison?: string;
}

export interface LighthouseRunnerOptions {
  port: number;
  outputDir?: string;
  performanceMinScore?: number;
  categories?: string[];
}

export interface LighthouseRunner {
  run(page: Page, url: string, options: LighthouseRunnerOptions): Promise<LighthouseResult>;
  assertScores(result: LighthouseResult, minScores?: Record<string, number>): void;
}

export class LighthouseRunnerImpl implements LighthouseRunner {
  async run(page: Page, url: string, options: LighthouseRunnerOptions): Promise<LighthouseResult> {
    const { port, outputDir, performanceMinScore = 50, categories = ['performance', 'accessibility', 'best-practices', 'seo'] } = options;

    const auditResult = await playAudit({
      page,
      url,
      port,
      thresholds: { performance: performanceMinScore },
      opts: {
        onlyCategories: categories as never
      },
      reports: outputDir
        ? {
            formats: { json: true, html: true },
            directory: outputDir,
            name: `lighthouse-${Date.now()}`
          }
        : undefined,
      ignoreError: true,
      disableLogs: true
    });

    const scores: Record<string, number> = {};
    for (const [category, value] of Object.entries(auditResult.lhr.categories ?? {})) {
      scores[category] = value.score ?? 0;
    }

    return {
      url,
      scores,
      timestamp: new Date().toISOString(),
      comparison: auditResult.comparison
    };
  }

  assertScores(result: LighthouseResult, minScores?: Record<string, number>): void {
    const thresholds = minScores ?? { performance: 50 };
    for (const [category, min] of Object.entries(thresholds)) {
      const actual = result.scores[category];
      if (actual === undefined) {
        throw new Error(`Lighthouse category '${category}' missing from results`);
      }
      if (actual < min) {
        throw new Error(`Lighthouse '${category}' score ${actual} below minimum ${min}`);
      }
    }
  }
}

export function createLighthouseRunner(): LighthouseRunner {
  return new LighthouseRunnerImpl();
}