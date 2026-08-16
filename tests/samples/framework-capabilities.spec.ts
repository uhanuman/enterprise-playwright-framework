import { test, expect } from '../../src/framework/testBase.js';
import path from 'node:path';
import { parseJson, deepMerge, aggregate } from '../../src/utils/json/index.js';

test('framework config, logger, and artifacts are wired', async ({
  frameworkConfig,
  frameworkLogger,
  artifactManager,
  dataProvider
}) => {
  expect(frameworkConfig.environment).toBeTruthy();
  expect(frameworkConfig.outputDir).toBeTruthy();

  frameworkLogger.info('capabilities smoke test', { env: frameworkConfig.environment });

  const screenshotPath = await artifactManager.writeArtifact(
    'screenshots',
    'sample-web.png',
    Buffer.from('placeholder')
  );
  await artifactManager.writeArtifact('logs', 'sample-web.log', `Visited ${frameworkConfig.baseUrl}\n`);
  expect(screenshotPath).toContain(path.join(frameworkConfig.outputDir, ''));

  const data = await dataProvider.load('user-login');
  expect(data.email).toBe('user@example.com');
});

test('parameter engine resolves date and runtime tokens in test data', async ({ dataProvider, runtimeStore }) => {
  runtimeStore.set('travel', 'acknowledgement-no-generated-in-current-session', 'ACK-2026-001');
  const travel = await dataProvider.load('test-data-travel');

  expect(travel.acknowledgement).toBe('ACK-2026-001');
  expect(travel.referenceId).toBe('ACK-2026-001');

  const startDate = String(travel.startDate);
  expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('CSV data provider loads and resolves values', async ({ dataProvider }) => {
  const rows = await dataProvider.loadCsv('sample-users');
  expect(rows.length).toBe(2);
  expect(rows[0].email).toBe('user1@example.com');
});

test('JSON utility suite works end to end', () => {
  const base = { users: [{ id: 1, name: 'Ada' }] };
  const patch = { users: [{ id: 2, name: 'Grace' }] };
  const merged = deepMerge(base, patch) as { users: { id: number }[] };
  expect(merged.users).toHaveLength(2);

  const parsed = parseJson<{ a: number }>('{"a":1}');
  expect(parsed.a).toBe(1);

  const totals = aggregate({ items: [{ price: 10 }, { price: 20 }] }, '$..price', 'sum');
  expect(totals).toBe(30);
});