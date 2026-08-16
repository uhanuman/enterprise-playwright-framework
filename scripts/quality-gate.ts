import fs from 'node:fs';
import path from 'node:path';
import { createFrameworkConfig } from '../src/config/manager.js';

interface QualityGateOptions {
  outputDir: string;
  axeMaxViolations: number;
  lighthouseMinScore: number;
}

interface TestInfoEntry {
  title: string;
  status: string;
  durationMs?: number;
}

function collectTestInfo(outputDir: string): TestInfoEntry[] {
  const reportsDir = path.join(outputDir, 'reports');
  if (!fs.existsSync(reportsDir)) return [];
  const entries: TestInfoEntry[] = [];
  for (const file of fs.readdirSync(reportsDir)) {
    if (!file.endsWith('.test-info.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(reportsDir, file), 'utf8')) as TestInfoEntry;
      entries.push(data);
    } catch {
      // skip unreadable
    }
  }
  return entries;
}

function collectQualityReports(outputDir: string): string[] {
  const qualityDir = path.join(outputDir, 'quality');
  if (!fs.existsSync(qualityDir)) return [];
  return fs.readdirSync(qualityDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(qualityDir, f));
}

async function main(): Promise<void> {
  const config = await createFrameworkConfig(process.cwd());
  const options: QualityGateOptions = {
    outputDir: config.outputDir,
    axeMaxViolations: config.quality.axeMaxViolations,
    lighthouseMinScore: config.quality.lighthouseMinScore
  };

  const failures: string[] = [];

  const testInfos = collectTestInfo(options.outputDir);
  if (testInfos.length > 0) {
    const failed = testInfos.filter((t) => t.status === 'failed');
    if (failed.length > 0) {
      failures.push(`Failed tests: ${failed.map((t) => t.title).join(', ')}`);
    }
  }

  const qualityReports = collectQualityReports(options.outputDir);
  for (const reportPath of qualityReports) {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Record<string, unknown>;
    if (report.kind === 'axe' && typeof report.violations === 'number') {
      if ((report.violations as number) > options.axeMaxViolations) {
        failures.push(
          `Accessibility violations (${report.violations}) exceed threshold (${options.axeMaxViolations}) in ${reportPath}`
        );
      }
    }
    if (report.kind === 'lighthouse' && typeof report.performance === 'number') {
      if ((report.performance as number) < options.lighthouseMinScore) {
        failures.push(
          `Lighthouse performance (${report.performance}) below minimum (${options.lighthouseMinScore}) in ${reportPath}`
        );
      }
    }
  }

  if (failures.length > 0) {
    console.error('Quality gate FAILED:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log('Quality gate passed.');
}

main();