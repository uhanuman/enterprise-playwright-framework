import { test as base } from 'playwright-bdd';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createFrameworkConfig, FrameworkConfig, RuntimeStore } from '../config/manager.js';
import { createLogger, FrameworkLogger } from '../logging/logger.js';
import { ArtifactManager } from './artifactManager.js';
import { createDataProvider, DataProvider } from './dataProvider.js';
import { ActionBuilder, ActionBuilderOptions } from '../web/actionBuilder.js';
import { formPopulator, FormPopulatorOptions, LocatorMap } from '../web/formPopulator.js';
import { createSpecLoader } from '../api/specLoader.js';
import { ApiClient } from '../api/apiClient.js';
import { createContractValidator, ContractValidator } from '../api/contractValidator.js';
import { getRunMetadata } from './artifactManager.js';
import { createAutoHooks, AutoHooksFixture } from './hooks.js';

export type ActionBuilderFactory = (options?: ActionBuilderOptions) => ActionBuilder;
export type FormPopulatorFn = (
  page: Page,
  locators: LocatorMap,
  testData: Record<string, unknown>,
  options?: FormPopulatorOptions
) => ReturnType<typeof formPopulator>;

export interface FrameworkFixtures extends AutoHooksFixture {
  frameworkConfig: FrameworkConfig;
  frameworkLogger: FrameworkLogger;
  artifactManager: ArtifactManager;
  runtimeStore: RuntimeStore;
  dataProvider: DataProvider;
  apiClient: ApiClient;
  contractValidator: ContractValidator;
  actionBuilder: ActionBuilderFactory;
  formPopulator: FormPopulatorFn;
  specLoader: ReturnType<typeof createSpecLoader>;
}

const { _frameworkHooks } = createAutoHooks();

export const test = base.extend<FrameworkFixtures>({
  _frameworkHooks,

  frameworkConfig: async ({}, use) => {
    const config = await createFrameworkConfig(process.cwd());
    await use(config);
  },

  frameworkLogger: async ({ frameworkConfig }, use, testInfo) => {
    await use(createLogger(frameworkConfig, testInfo.title));
  },

  runtimeStore: async ({ frameworkConfig }, use) => {
    const store = new RuntimeStore(frameworkConfig.environment);
    await store.load(process.cwd());
    await use(store);
  },

  artifactManager: async ({ frameworkConfig }, use, testInfo) => {
    const manager = new ArtifactManager(frameworkConfig, testInfo.title);
    await manager.initialize();
    await use(manager);
  },

  dataProvider: async ({ frameworkConfig, runtimeStore }, use, testInfo) => {
    const meta = getRunMetadata(frameworkConfig);
    const provider = await createDataProvider({
      config: frameworkConfig,
      runtimeStore,
      testName: testInfo.title,
      runId: meta.runId
    });
    await use(provider);
  },

  specLoader: async ({}, use) => {
    await use(createSpecLoader());
  },

  apiClient: async ({ frameworkConfig, request }, use) => {
    await use(new ApiClient({
      baseURL: frameworkConfig.apiBaseUrl,
      request
    }));
  },

  contractValidator: async ({}, use) => {
    await use(createContractValidator());
  },

  actionBuilder: async ({ page }, use) => {
    await use((options) => new ActionBuilder(page, options));
  },

  formPopulator: async ({ runtimeStore, frameworkConfig }, use, testInfo) => {
    const meta = getRunMetadata(frameworkConfig);
    const resolver = await createValueResolver(frameworkConfig, runtimeStore, testInfo.title, meta.runId);
    await use(async (page, locators, testData, options = {}) => {
      return formPopulator(page, locators, testData, {
        ...options,
        resolveParams: true,
        parameterResolver: resolver
      });
    });
  }
});

async function createValueResolver(
  config: FrameworkConfig,
  runtimeStore: RuntimeStore,
  testName: string,
  runId: string
): Promise<(value: string) => string> {
  const { createParameterEngine } = await import('../utils/parameters.js');
  const engine = createParameterEngine(config, {
    runId,
    testName,
    runtimeGet: (pathKey) => runtimeStore.get(pathKey) ?? runtimeStore.getFlat(pathKey)
  });
  return (value) => engine.resolveString(value);
}

export { expect };
export type { Page };