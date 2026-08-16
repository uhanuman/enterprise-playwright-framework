import type { Page, Locator, Response, Download, FileChooser } from '@playwright/test';
import { ActionBuilder } from './actionBuilder.js';

export abstract class BasePage {
  protected readonly page: Page;
  protected readonly actionBuilder: ActionBuilder;

  constructor(page: Page, baseURL = '') {
    this.page = page;
    this.actionBuilder = new ActionBuilder(page, { baseURL });
  }

  protected locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  protected getByRole(role: Parameters<Locator['getByRole']>[0], options?: Parameters<Locator['getByRole']>[1]): Locator {
    return this.page.getByRole(role, options);
  }

  protected getByLabel(label: string): Locator {
    return this.page.getByLabel(label);
  }

  protected getByText(text: string | RegExp): Locator {
    return this.page.getByText(text);
  }

  protected getByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  protected getByPlaceholder(placeholder: string): Locator {
    return this.page.getByPlaceholder(placeholder);
  }

  async goto(url: string): Promise<Response | null> {
    return this.page.goto(url);
  }

  async waitForLoadState(state: 'load' | 'domcontentloaded' | 'networkidle' = 'load'): Promise<void> {
    await this.page.waitForLoadState(state);
  }

  async waitForTimeout(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async getUrl(): Promise<string> {
    return this.page.url();
  }

  async isVisible(selector: string): Promise<boolean> {
    return this.locator(selector).isVisible();
  }

  async waitForDownload(): Promise<Download> {
    return this.page.waitForEvent('download');
  }

  async onFileChooser(): Promise<FileChooser> {
    return this.page.waitForEvent('filechooser');
  }

  actions(): ActionBuilder {
    return this.actionBuilder;
  }

  get pageInstance(): Page {
    return this.page;
  }
}