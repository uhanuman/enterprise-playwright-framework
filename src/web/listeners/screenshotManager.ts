import type { Page } from '@playwright/test';
import { ensureDirSync } from '../../utils/file.js';

export interface ScreenshotOptions {
  fullPage?: boolean;
  screenshotDir?: string;
  metadata?: Record<string, unknown>;
}

export interface ScreenshotManager {
  capture(page: Page, name: string, options?: ScreenshotOptions): Promise<string | undefined>;
}

export class ScreenshotManagerImpl implements ScreenshotManager {
  private readonly screenshots: { name: string; path: string }[] = [];

  constructor(private defaultDir?: string) {}

  async capture(page: Page, name: string, options: ScreenshotOptions = {}): Promise<string | undefined> {
    const dir = options.screenshotDir ?? this.defaultDir;
    if (!dir) {
      await page.screenshot({ fullPage: options.fullPage ?? false });
      return undefined;
    }
    ensureDirSync(dir);
    const sanitized = name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = Date.now();
    const filePath = `${dir}/${sanitized}-${timestamp}.png`;
    await page.screenshot({ path: filePath, fullPage: options.fullPage ?? false });
    this.screenshots.push({ name, path: filePath });
    return filePath;
  }

  list(): { name: string; path: string }[] {
    return [...this.screenshots];
  }
}

export function createScreenshotManager(screenshotDir?: string): ScreenshotManager {
  return new ScreenshotManagerImpl(screenshotDir);
}