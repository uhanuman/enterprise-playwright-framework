import path from 'node:path';
import { readJsonFile, readJsonFileSafe, parseJson } from '../utils/json/index.js';
import { readCsvFile } from '../utils/csv.js';
import { readTextFile } from '../utils/file.js';
import { createParameterEngine, hasTokens, ResolveValue } from '../utils/parameters.js';
import { createFrameworkConfig, RuntimeStore, FrameworkConfig } from '../config/manager.js';
import type { LocatorMap } from '../web/formPopulator.js';

export interface DataProviderOptions {
  rootDir?: string;
  config?: FrameworkConfig;
  runtimeStore?: RuntimeStore;
  testName?: string;
  runId?: string;
}

export interface DataProvider {
  load(name: string): Promise<Record<string, unknown>>;
  loadJson(name: string): Promise<unknown>;
  loadCsv(name: string): Promise<Record<string, string>[]>;
  loadText(name: string): Promise<string>;
  loadLocators(name: string): Promise<LocatorMap>;
  resolve(value: ResolveValue): ResolveValue;
  loadEnv(name: string): Promise<Record<string, string>>;
}

export async function createDataProvider(options: DataProviderOptions = {}): Promise<DataProvider> {
  const rootDir = options.rootDir ?? process.cwd();
  const config = options.config ?? (await createFrameworkConfig(rootDir));
  const runtimeStore = options.runtimeStore ?? new RuntimeStore(config.environment);

  const engine = createParameterEngine(config, {
    runId: options.runId,
    testName: options.testName,
    runtimeGet: (pathKey) => runtimeStore.get(pathKey) ?? runtimeStore.getFlat(pathKey)
  });

  const globalDir = path.join(rootDir, 'test-data', 'global');
  const envDir = path.join(rootDir, 'test-data', config.environment);

  const loadJson = async (name: string): Promise<unknown> => {
    const basePath = path.join(globalDir, `${name}.json`);
    const overlayPath = path.join(envDir, `${name}.json`);
    const base = await readJsonFileSafe<Record<string, unknown>>(basePath, {});
    const overlay = await readJsonFileSafe<Record<string, unknown>>(overlayPath, {});
    const merged: Record<string, unknown> = { ...base, ...overlay };
    return engine.resolve(merged as ResolveValue);
  };

  const load = async (name: string): Promise<Record<string, unknown>> => {
    const value = await loadJson(name);
    return (value ?? {}) as Record<string, unknown>;
  };

  const loadCsv = async (name: string): Promise<Record<string, string>[]> => {
    const csvPath = path.join(envDir, `${name}.csv`);
    if (await filePathExists(csvPath)) {
      return readCsvFile(csvPath);
    }
    const rows = await readCsvFile(path.join(globalDir, `${name}.csv`));
    return rows.map((row) => {
      const resolved: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        resolved[key] = engine.resolveString(value);
      }
      return resolved;
    });
  };

  const loadText = async (name: string): Promise<string> => {
    const textPath = path.join(envDir, `${name}.txt`);
    const globalPath = path.join(globalDir, `${name}.txt`);
    const filePath = await filePathExists(textPath) ? textPath : globalPath;
    const content = await readTextFile(filePath);
    return engine.resolveString(content);
  };

  const loadEnv = async (name: string): Promise<Record<string, string>> => {
    const envFile = path.join(envDir, `${name}.env`);
    const globalFile = path.join(globalDir, `${name}.env`);
    const filePath = await filePathExists(envFile) ? envFile : globalFile;
    const content = await readTextFile(filePath);
    const result: Record<string, string> = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      result[trimmed.slice(0, eqIndex).trim()] = engine.resolveString(trimmed.slice(eqIndex + 1).trim());
    }
    return result;
  };

  const loadLocators = async (name: string): Promise<LocatorMap> => {
    const value = await loadJson(name);
    return (value ?? {}) as LocatorMap;
  };

  return {
    load,
    loadJson: (name) => loadJson(name),
    loadCsv,
    loadText,
    loadEnv,
    loadLocators,
    resolve: (value) => engine.resolve(value)
  };
}

async function filePathExists(filePath: string): Promise<boolean> {
  try {
    const fsp = await import('node:fs/promises');
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export { hasTokens, parseJson };