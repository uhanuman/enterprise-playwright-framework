import type { Page } from '@playwright/test';
import { writeJsonFile } from '../utils/json/io.js';
import { ensureDirSync } from '../utils/file.js';

export interface AxeViolation {
  id: string;
  impact: string;
  description: string;
  help: string;
  helpUrl: string;
  nodes: number;
}

export interface AxeResult {
  url: string;
  violations: AxeViolation[];
  passes: number;
  incomplete: number;
  timestamp: string;
  raw?: unknown;
}

export interface AxeRunnerOptions {
  outputDir?: string;
  maxViolations?: number;
  disableRules?: string[];
  include?: string[];
  exclude?: string[];
}

export interface AxeRunner {
  run(page: Page, options?: AxeRunnerOptions): Promise<AxeResult>;
  assertAccessible(result: AxeResult, maxViolations?: number): void;
}

export class AxeRunnerImpl implements AxeRunner {
  async run(page: Page, options: AxeRunnerOptions = {}): Promise<AxeResult> {
    const { AxeBuilder } = await import('@axe-core/playwright');

    let builder = new AxeBuilder({ page });
    if (options.disableRules?.length) {
      builder = builder.disableRules(options.disableRules);
    }
    if (options.include?.length) {
      for (const selector of options.include) {
        builder = builder.include(selector);
      }
    }
    if (options.exclude?.length) {
      for (const selector of options.exclude) {
        builder = builder.exclude(selector);
      }
    }

    const results = await builder.analyze();

    const violations: AxeViolation[] = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? 'unknown',
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodes: violation.nodes.length
    }));

    const result: AxeResult = {
      url: page.url(),
      violations,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      timestamp: new Date().toISOString(),
      raw: results
    };

    const outputDir = options.outputDir;
    if (outputDir) {
      ensureDirSync(outputDir);
      await writeJsonFile(`${outputDir}/axe-${Date.now()}.json`, {
        url: result.url,
        violations,
        passes: result.passes,
        incomplete: result.incomplete,
        timestamp: result.timestamp
      });
    }

    return result;
  }

  assertAccessible(result: AxeResult, maxViolations = 0): void {
    if (result.violations.length > maxViolations) {
      const summary = result.violations
        .map((v) => `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes} nodes)`)
        .join('\n');
      throw new Error(
        `Accessibility violations (${result.violations.length}) exceed maximum (${maxViolations}):\n${summary}`
      );
    }
  }
}

export function createAxeRunner(): AxeRunner {
  return new AxeRunnerImpl();
}