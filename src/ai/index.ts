import { AiProvider, AiProviderConfig, createAiProvider, isAiEnabled } from './provider.js';
import { TestDataGenerator, createTestDataGenerator } from './testDataGenerator.js';
import { MockResponseBuilder, createMockResponseBuilder } from './mockResponseBuilder.js';
import { LocatorHealer, createLocatorHealer } from './locatorHealer.js';
import { ScriptSuggester, createScriptSuggester } from './scriptSuggester.js';

export interface AiModules {
  enabled: boolean;
  testDataGenerator?: TestDataGenerator;
  mockResponseBuilder?: MockResponseBuilder;
  locatorHealer?: LocatorHealer;
  scriptSuggester?: ScriptSuggester;
}

export function createAiModules(env = process.env): AiModules {
  const enabled = isAiEnabled(env);
  if (!enabled) {
    return { enabled: false };
  }
  return {
    enabled: true,
    testDataGenerator: createTestDataGenerator(),
    mockResponseBuilder: createMockResponseBuilder(),
    locatorHealer: createLocatorHealer(),
    scriptSuggester: createScriptSuggester()
  };
}

export { AiProvider, AiProviderConfig, createAiProvider, isAiEnabled };
export type { TestDataGenerator, MockResponseBuilder, LocatorHealer, ScriptSuggester };