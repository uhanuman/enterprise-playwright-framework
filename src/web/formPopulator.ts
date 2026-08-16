import type { Page, Locator } from '@playwright/test';
import type { ActionStep } from './actionBuilder.js';

export type FieldType = 'textbox' | 'textarea' | 'dropdown' | 'radio' | 'checkbox' | 'click' | 'wait';

export interface LocatorMetadata {
  locator?: string;
  type: FieldType;
  option?: string | string[];
  state?: 'checked' | 'unchecked';
  before?: ActionStep[];
  after?: ActionStep[];
}

export type LocatorMap = Record<string, LocatorMetadata>;

export interface FormPopulatorOptions {
  skipEmpty?: boolean;
  resolveParams?: boolean;
  onFieldError?: 'fail' | 'skip' | 'warn';
  formIoIds?: boolean;
  parameterResolver?: (value: string) => string;
  logger?: { warn(message: string, data?: unknown): void; error(message: string, data?: unknown): void };
}

export interface FormPopulationResult {
  populated: string[];
  skipped: string[];
  failed: string[];
}

export async function formPopulator(
  page: Page,
  locators: LocatorMap,
  testData: Record<string, unknown>,
  options: FormPopulatorOptions = {}
): Promise<FormPopulationResult> {
  const {
    skipEmpty = true,
    resolveParams = true,
    onFieldError = 'fail',
    formIoIds = true,
    parameterResolver
  } = options;

  const result: FormPopulationResult = { populated: [], skipped: [], failed: [] };

  for (const [key, metadata] of Object.entries(locators)) {
    const rawValue = testData[key];
    const isEmpty = rawValue === undefined || rawValue === null || rawValue === '';

    if (isEmpty && skipEmpty && metadata.type !== 'click') {
      result.skipped.push(key);
      continue;
    }

    let value = String(rawValue ?? '');
    if (resolveParams && parameterResolver && value) {
      value = parameterResolver(value);
    }

    const locatorString = metadata.locator ?? (formIoIds ? `#${key}` : undefined);
    if (!locatorString) {
      handleFieldError(key, 'missing-locator', options, result, 'No locator provided and Form.io fallback disabled');
      continue;
    }

    try {
      await executeInterleaved(page, metadata.before);
      await populateField(page, locatorString, metadata, value);
      await executeInterleaved(page, metadata.after);
      result.populated.push(key);
    } catch (error) {
      handleFieldError(key, 'interaction-failed', options, result, error instanceof Error ? error.message : String(error));
    }
  }

  return result;
}

async function populateField(page: Page, locatorString: string, metadata: LocatorMetadata, value: string): Promise<void> {
  const locator = page.locator(locatorString);

  switch (metadata.type) {
    case 'textbox':
    case 'textarea':
      await locator.fill(value);
      break;
    case 'dropdown':
      await locator.selectOption(metadata.option ?? value);
      break;
    case 'radio':
      await selectRadio(page, locator, metadata, value);
      break;
    case 'checkbox':
      if (metadata.state === 'unchecked') {
        await locator.uncheck();
      } else {
        await locator.check();
      }
      break;
    case 'click':
      await locator.click();
      break;
    case 'wait':
      await locator.waitFor({ state: 'visible' });
      break;
    default: {
      const exhaustive: never = metadata.type;
      throw new Error(`Unsupported field type: ${String(exhaustive)}`);
    }
  }
}

async function selectRadio(page: Page, locator: Locator, metadata: LocatorMetadata, value: string): Promise<void> {
  const option = metadata.option ?? value;
  const exactLabel = page.locator(`label:has-text("${option}")`);
  if (await exactLabel.count() > 0) {
    await exactLabel.first().click();
    return;
  }
  await locator.check();
}

async function executeInterleaved(page: Page, steps: ActionStep[] | undefined): Promise<void> {
  if (!steps) return;
  for (const step of steps) {
    switch (step.type) {
      case 'click':
        await page.locator(step.selector).click();
        break;
      case 'waitForTimeout':
        await page.waitForTimeout(step.ms);
        break;
      case 'waitForSelector':
        await page.waitForSelector(step.selector, { state: step.state ?? 'visible' });
        break;
      case 'scroll':
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        break;
      default:
        break;
    }
  }
}

function handleFieldError(
  key: string,
  reason: string,
  options: FormPopulatorOptions,
  result: FormPopulationResult,
  message: string
): void {
  result.failed.push(key);
  const mode = options.onFieldError ?? 'fail';
  if (mode === 'skip') {
    options.logger?.warn(`Skipped field '${key}' (${reason}): ${message}`);
    result.skipped.push(key);
    result.failed.pop();
    return;
  }
  if (mode === 'warn') {
    options.logger?.warn(`Form field '${key}' (${reason}): ${message}`);
    return;
  }
  throw new Error(`Form field '${key}' failed (${reason}): ${message}`);
}

export { executeInterleaved };