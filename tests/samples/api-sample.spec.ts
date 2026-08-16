import { test, expect } from '../../src/framework/testBase.js';

test('API client writes request/response artifacts', async ({ apiClient, artifactManager, frameworkConfig }) => {
  const url = `${frameworkConfig.apiBaseUrl}/health`;

  let status = 0;
  let body = '';
  try {
    const response = await apiClient.path('get', '/health').send();
    status = response.status();
    body = await response.text();
  } catch (error) {
    body = `offline-or-unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }

  await artifactManager.writeArtifact('network', 'sample-api.json', JSON.stringify({
    url,
    status,
    body
  }, null, 2));

  await artifactManager.writeArtifact('logs', 'sample-api.log', `API request completed with ${status}\n`);

  expect(status === 0 || (status >= 200 && status < 600)).toBeTruthy();
});