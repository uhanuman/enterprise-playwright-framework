import type { Page, Locator, ElementHandle } from '@playwright/test';

export type ActionStep =
  | { type: 'navigate'; url: string }
  | { type: 'fill'; selector: string; value: string }
  | { type: 'type'; selector: string; value: string }
  | { type: 'click'; selector: string }
  | { type: 'dblclick'; selector: string }
  | { type: 'selectOption'; selector: string; value: string }
  | { type: 'check'; selector: string }
  | { type: 'uncheck'; selector: string }
  | { type: 'waitForTimeout'; ms: number }
  | { type: 'waitForSelector'; selector: string; state?: 'attached' | 'detached' | 'visible' | 'hidden' }
  | { type: 'waitForNavigation' }
  | { type: 'assertVisible'; selector: string }
  | { type: 'assertHidden'; selector: string }
  | { type: 'assertText'; selector: string; text: string }
  | { type: 'assertValue'; selector: string; value: string }
  | { type: 'screenshot'; name: string }
  | { type: 'scroll'; selector?: string; direction?: 'up' | 'down' }
  | { type: 'hover'; selector: string }
  | { type: 'press'; selector: string; key: string }
  | { type: 'upload'; selector: string; files: string | string[] }
  | { type: 'eval'; expression: string };

export interface ActionBuilderOptions {
  baseURL?: string;
  screenshotDir?: string;
  stepScreenshots?: boolean;
}

export interface ActionExecutionResult {
  stepIndex: number;
  stepType: string;
  error?: Error;
}

export class ActionBuilder {
  private steps: ActionStep[] = [];
  private readonly page: Page;
  private readonly options: {
    baseURL: string;
    screenshotDir?: string;
    stepScreenshots: boolean;
  };

  constructor(page: Page, options: ActionBuilderOptions = {}) {
    this.page = page;
    this.options = {
      baseURL: options.baseURL ?? '',
      screenshotDir: options.screenshotDir,
      stepScreenshots: options.stepScreenshots ?? false
    };
  }

  locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  navigate(url: string): this {
    this.steps.push({ type: 'navigate', url });
    return this;
  }

  fill(selector: string, value: string): this {
    this.steps.push({ type: 'fill', selector, value });
    return this;
  }

  type(selector: string, value: string): this {
    this.steps.push({ type: 'type', selector, value });
    return this;
  }

  click(selector: string): this {
    this.steps.push({ type: 'click', selector });
    return this;
  }

  dblclick(selector: string): this {
    this.steps.push({ type: 'dblclick', selector });
    return this;
  }

  selectOption(selector: string, value: string): this {
    this.steps.push({ type: 'selectOption', selector, value });
    return this;
  }

  check(selector: string): this {
    this.steps.push({ type: 'check', selector });
    return this;
  }

  uncheck(selector: string): this {
    this.steps.push({ type: 'uncheck', selector });
    return this;
  }

  waitForTimeout(ms: number): this {
    this.steps.push({ type: 'waitForTimeout', ms });
    return this;
  }

  waitForSelector(selector: string, state: 'attached' | 'detached' | 'visible' | 'hidden' = 'visible'): this {
    this.steps.push({ type: 'waitForSelector', selector, state });
    return this;
  }

  waitForNavigation(): this {
    this.steps.push({ type: 'waitForNavigation' });
    return this;
  }

  assertVisible(selector: string): this {
    this.steps.push({ type: 'assertVisible', selector });
    return this;
  }

  assertHidden(selector: string): this {
    this.steps.push({ type: 'assertHidden', selector });
    return this;
  }

  assertText(selector: string, text: string): this {
    this.steps.push({ type: 'assertText', selector, text });
    return this;
  }

  assertValue(selector: string, value: string): this {
    this.steps.push({ type: 'assertValue', selector, value });
    return this;
  }

  screenshot(name: string): this {
    this.steps.push({ type: 'screenshot', name });
    return this;
  }

  scroll(selector?: string, direction: 'up' | 'down' = 'down'): this {
    this.steps.push({ type: 'scroll', selector, direction });
    return this;
  }

  hover(selector: string): this {
    this.steps.push({ type: 'hover', selector });
    return this;
  }

  press(selector: string, key: string): this {
    this.steps.push({ type: 'press', selector, key });
    return this;
  }

  upload(selector: string, files: string | string[]): this {
    this.steps.push({ type: 'upload', selector, files });
    return this;
  }

  eval(expression: string): this {
    this.steps.push({ type: 'eval', expression });
    return this;
  }

  addStep(step: ActionStep): this {
    this.steps.push(step);
    return this;
  }

  importSteps(steps: ActionStep[] | string): this {
    const parsed: ActionStep[] = typeof steps === 'string' ? (JSON.parse(steps) as ActionStep[]) : steps;
    this.steps.push(...parsed);
    return this;
  }

  exportSteps(): string {
    return JSON.stringify(this.steps, null, 2);
  }

  getSteps(): ActionStep[] {
    return [...this.steps];
  }

  private async resolveUrl(url: string): Promise<string> {
    if (/^https?:\/\//i.test(url)) return url;
    const base = this.options.baseURL ?? '';
    return `${base.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  }

  private async runStep(step: ActionStep): Promise<void> {
    const page = this.page;
    switch (step.type) {
      case 'navigate':
        await page.goto(await this.resolveUrl(step.url));
        break;
      case 'fill':
        await this.locator(step.selector).fill(step.value);
        break;
      case 'type':
        await this.locator(step.selector).pressSequentially(step.value);
        break;
      case 'click':
        await this.locator(step.selector).click();
        break;
      case 'dblclick':
        await this.locator(step.selector).dblclick();
        break;
      case 'selectOption':
        await this.locator(step.selector).selectOption(step.value);
        break;
      case 'check':
        await this.locator(step.selector).check();
        break;
      case 'uncheck':
        await this.locator(step.selector).uncheck();
        break;
      case 'waitForTimeout':
        await page.waitForTimeout(step.ms);
        break;
      case 'waitForSelector':
        await page.waitForSelector(step.selector, { state: step.state ?? 'visible' });
        break;
      case 'waitForNavigation':
        await page.waitForLoadState('networkidle');
        break;
      case 'assertVisible':
        await this.locator(step.selector).waitFor({ state: 'visible' });
        break;
      case 'assertHidden':
        await this.locator(step.selector).waitFor({ state: 'hidden' });
        break;
      case 'assertText':
        await this.locator(step.selector).getByText(step.text).first().waitFor({ state: 'visible' });
        break;
      case 'assertValue': {
        const actual = await this.locator(step.selector).inputValue();
        if (actual !== step.value) {
          throw new Error(`Value assertion failed for '${step.selector}': expected '${step.value}', got '${actual}'`);
        }
        break;
      }
      case 'screenshot':
        await this.captureScreenshot(step.name);
        break;
      case 'scroll':
        if (step.selector) {
          await this.locator(step.selector).scrollIntoViewIfNeeded();
        } else {
          await page.evaluate((direction) => {
            window.scrollBy(0, direction === 'up' ? -window.innerHeight : window.innerHeight);
          }, step.direction);
        }
        break;
      case 'hover':
        await this.locator(step.selector).hover();
        break;
      case 'press':
        await this.locator(step.selector).press(step.key);
        break;
      case 'upload':
        await this.locator(step.selector).setInputFiles(step.files);
        break;
      case 'eval':
        await page.evaluate(`(${step.expression});`);
        break;
      default: {
        const exhaustive: never = step;
        throw new Error(`Unsupported action step type: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  private async captureScreenshot(name: string): Promise<void> {
    const screenshotDir = this.options.screenshotDir;
    if (!screenshotDir) {
      await this.page.screenshot({ path: undefined });
      return;
    }
    const sanitized = name.replace(/[^a-zA-Z0-9-_]/g, '_');
    await this.page.screenshot({ path: `${screenshotDir}/${sanitized}.png` });
  }

  async execute(): Promise<ActionExecutionResult[]> {
    const results: ActionExecutionResult[] = [];
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      try {
        await this.runStep(step);
        results.push({ stepIndex: i, stepType: step.type });
      } catch (error) {
        const wrapped = error instanceof Error ? error : new Error(String(error));
        results.push({ stepIndex: i, stepType: step.type, error: wrapped });
        throw new Error(
          `ActionBuilder failed at step ${i} (${step.type}): ${wrapped.message}`,
          { cause: wrapped }
        );
      }
    }
    return results;
  }
}

export function actionBuilder(page: Page, options: ActionBuilderOptions = {}): ActionBuilder {
  return new ActionBuilder(page, options);
}

export type { Page, Locator, ElementHandle };