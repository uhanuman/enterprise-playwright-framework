import http from 'node:http';
import path from 'node:path';
import { test, expect } from '../../src/framework/testBase.js';
import { createSpecLoader } from '../../src/api/specLoader.js';
import { createApiClient, ApiClient } from '../../src/api/apiClient.js';
import { createContractValidator } from '../../src/api/contractValidator.js';
import { expectStatus, expectRequiredFields } from '../../src/api/responseAssertions.js';
import type { AddressInfo } from 'node:net';

const SPEC_PATH = path.resolve('specs/openapi/sample.yaml');

test.describe('API contract validation against a live server', () => {
  let server: http.Server;
  let baseURL: string;

  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      if (req.url === '/users' && req.method === 'GET') {
        res.end(JSON.stringify([
          { id: 1, name: 'Ada', email: 'ada@example.com' },
          { id: 2, name: 'Grace', email: 'grace@example.com' }
        ]));
        return;
      }
      if (req.url === '/users' && req.method === 'POST') {
        res.statusCode = 201;
        res.end(JSON.stringify({ id: 3, name: 'Alan', email: 'alan@example.com' }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'not found' }));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseURL = `http://localhost:${port}/`;
  });

  test.afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('apiClient composes requests and returns typed responses', async ({ request }) => {
    const client = new ApiClient({ baseURL, request });
    const response = await client.path('get', '/users').send();

    expectStatus(response, 200);
    const body = (await response.json()) as { id: number; name: string; email: string }[];
    expect(body).toHaveLength(2);
    expect(response.timing()).toBeGreaterThanOrEqual(0);
  });

  test('contractValidator validates response against OpenAPI schema', async ({ request }) => {
    const spec = await createSpecLoader().load(SPEC_PATH);
    const operation = spec.findOperation('get', '/users');
    const schema = (operation?.responses['200'] as { content: { 'application/json': { schema: unknown } } })
      .content['application/json'].schema;

    const client = new ApiClient({ baseURL, request });
    const response = await client.path('get', '/users').send();
    const result = await createContractValidator().assertValid(response, schema);

    expect(result.valid).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  test('operation lookup resolves request schema from spec', async ({ request }) => {
    const spec = await createSpecLoader().load(SPEC_PATH);
    const operation = spec.findOperationById('createUser');
    expect(operation?.path).toBe('/users');
    expect(operation?.method).toBe('post');

    const requestSchema = (operation?.requestBody as { content: { 'application/json': { schema: unknown } } })
      .content['application/json'].schema;
    expect((requestSchema as { required: string[] }).required).toContain('name');

    const client = new ApiClient({ baseURL, request });
    const response = await client.path('post', '/users').withBody({ name: 'Alan', email: 'alan@example.com' }).send();
    expectStatus(response, 201);
    await expectRequiredFields(response, { required: ['id', 'name', 'email'] });
  });

  test('responseAssertions flags an unexpected status code', async ({ request }) => {
    const client = new ApiClient({ baseURL, request });
    const response = await client.path('get', '/missing').send();
    expectStatus(response, 404);
  });
});