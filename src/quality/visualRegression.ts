import { expect, Page, Locator } from '@playwright/test';
import { writeJsonFile } from '../utils/json/io.js';
import { ensureDirSync } from '../utils/file.js';

export interface VisualRegressionOptions {
  fullPage?: boolean;
  maxDiffPixelRatio?: number;
  maxDiffPixels?: number;
  threshold?: number;
  mask?: Locator[];
  maskColor?: string;
  animations?: 'allow' | 'disabled';
  scale?: 'css' | 'device';
}

export interface VisualRegressionRunner {
  expectScreenshot(page: Page, name: string, options?: VisualRegressionOptions): Promise<void>;
  expectLocatorScreenshot(locator: Locator, name: string, options?: VisualRegressionOptions): Promise<void>;
  capture(page: Page, name: string, options?: VisualRegressionOptions): Promise<string>;
  saveResult(outputDir: string, result: Record<string, unknown>): Promise<string>;
}

export class VisualRegressionRunnerImpl implements VisualRegressionRunner {
  async expectScreenshot(page: Page, name: string, options: VisualRegressionOptions = {}): Promise<void> {
    await expect(page).toHaveScreenshot(name, {
      fullPage: options.fullPage,
      maxDiffPixelRatio: options.maxDiffPixelRatio,
      maxDiffPixels: options.maxDiffPixels,
      threshold: options.threshold,
      mask: options.mask,
      maskColor: options.maskColor,
      animations: options.animations,
      scale: options.scale
    });
  }

  async expectLocatorScreenshot(locator: Locator, name: string, options: VisualRegressionOptions = {}): Promise<void> {
    await expect(locator).toHaveScreenshot(name, {
      maxDiffPixelRatio: options.maxDiffPixelRatio,
      maxDiffPixels: options.maxDiffPixels,
      threshold: options.threshold,
      animations: options.animations,
      scale: options.scale
    });
  }

  async capture(page: Page, name: string, options: VisualRegressionOptions = {}): Promise<string> {
    const filePath = `test-results/visual/${name}.png`;
    ensureDirSync(filePath.slice(0, filePath.lastIndexOf('/')));
    await page.screenshot({ path: filePath, fullPage: options.fullPage ?? false });
    return filePath;
  }

  async saveResult(outputDir: string, result: Record<string, unknown>): Promise<string> {
    ensureDirSync(outputDir);
    const filePath = `${outputDir}/visual-${Date.now()}.json`;
    await writeJsonFile(filePath, result);
    return filePath;
  }
}

export function createVisualRegressionRunner(): VisualRegressionRunner {
  return new VisualRegressionRunnerImpl();
}