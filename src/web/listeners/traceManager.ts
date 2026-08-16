import type { BrowserContext, Page } from '@playwright/test';
import { writeJsonFile } from '../../utils/json/io.js';
import { ensureDirSync } from '../../utils/file.js';

export interface TraceManagerOptions {
  enabled?: boolean;
  screenshots?: boolean;
  snapshots?: boolean;
  sources?: boolean;
  traceDir?: string;
}

export interface TraceManager {
  start(context: BrowserContext): Promise<void>;
  stop(context: BrowserContext): Promise<string | undefined>;
}

export class TraceManagerImpl implements TraceManager {
  private readonly options: Required<Pick<TraceManagerOptions, 'enabled' | 'screenshots' | 'snapshots' | 'sources'>> & TraceManagerOptions;
  private lastTracePath: string | undefined;

  constructor(options: TraceManagerOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      screenshots: options.screenshots ?? true,
      snapshots: options.snapshots ?? true,
      sources: options.sources ?? false,
      traceDir: options.traceDir
    };
  }

  async start(context: BrowserContext): Promise<void> {
    if (!this.options.enabled) return;
    await context.tracing.start({
      screenshots: this.options.screenshots,
      snapshots: this.options.snapshots,
      sources: this.options.sources
    });
  }

  async stop(context: BrowserContext): Promise<string | undefined> {
    if (!this.options.enabled) return undefined;
    const traceDir = this.options.traceDir;
    if (!traceDir) {
      await context.tracing.stop();
      return undefined;
    }
    ensureDirSync(traceDir);
    const tracePath = `${traceDir}/trace-${Date.now()}.zip`;
    await context.tracing.stop({ path: tracePath });
    this.lastTracePath = tracePath;
    return tracePath;
  }

  async writeMetadata(context: BrowserContext, meta: Record<string, unknown>): Promise<string | undefined> {
    if (!this.lastTracePath) return undefined;
    const dir = this.lastTracePath.slice(0, this.lastTracePath.lastIndexOf('/'));
    const metaPath = `${dir}/trace-metadata.json`;
    await writeJsonFile(metaPath, meta);
    return metaPath;
  }

  async capturePageSnapshot(page: Page, snapshotDir: string): Promise<string> {
    ensureDirSync(snapshotDir);
    const snapshotPath = `${snapshotDir}/snapshot-${Date.now()}.html`;
    await page.screenshot({ path: `${snapshotDir}/snapshot-${Date.now()}.png` });
    return snapshotPath;
  }
}

export function createTraceManager(options: TraceManagerOptions = {}): TraceManager {
  return new TraceManagerImpl(options);
}