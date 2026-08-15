import { test, expect } from '../../src/framework/testBase.js';

const sampleBaseUrl = process.env.BASE_URL ?? 'https://example.com';

test('ActionBuilder executes a fluent web flow', async ({ page, actionBuilder, artifactManager, frameworkLogger }) => {
  await actionBuilder({ baseURL: sampleBaseUrl })
    .navigate('/')
    .waitForSelector('h1')
    .assertVisible('h1')
    .screenshot('example-home')
    .execute();

  await expect(page).toHaveTitle(/Example/);
  frameworkLogger.info('ActionBuilder flow completed', { url: page.url() });

  await artifactManager.writeArtifact('logs', 'actionbuilder.log', 'action builder flow ok\n');
});

test('ActionBuilder steps can be exported and replayed as JSON', async ({ page, actionBuilder }) => {
  const flow = actionBuilder({ baseURL: sampleBaseUrl });
  flow.navigate('/').waitForSelector('h1').assertVisible('h1');

  const exported = flow.exportSteps();
  const replayed = actionBuilder({ baseURL: sampleBaseUrl });
  replayed.importSteps(exported);

  await replayed.execute();
  await expect(page).toHaveTitle(/Example/);
});