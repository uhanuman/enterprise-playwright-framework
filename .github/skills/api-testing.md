# Skill: API Testing Patterns

Comprehensive patterns for OpenAPI-driven API contract validation, integration testing, and response assertion. Use this skill when:
- Writing API contract validation tests against OpenAPI specs
- Building API integration test suites
- Validating request/response payloads
- Testing error scenarios and edge cases
- Working with parameter injection and data-driven API tests

## How to Use This Skill

Ask Copilot: "**Use the api-testing skill to create contract validation tests for the `/users` endpoint**"

Or for error scenarios:
"**Use api-testing to test error handling for POST /users with missing required fields**"

## Core Components

### 1. OpenAPI Spec Loading with `$ref` Dereferencing

```typescript
import { specLoader } from '../../src/api';

const spec = await specLoader.load('specs/openapi/sample.yaml');
// Automatically dereferences $ref pointers in components/schemas
```

**Spec location:** `specs/openapi/<spec-name>.yaml` or `.json`  
**Features:**
- Resolves `$ref` pointers to remote and local definitions
- Supports YAML and JSON formats
- Validates spec structure against OpenAPI 3.0 standard

### 2. API Client Builder Pattern

Fluent builder for constructing API requests:

```typescript
const response = await apiClient.builder(spec, 'POST', '/users')
  .setBody({ name: 'John', email: 'john@example.com' })
  .setQueryParams({ notify: true })
  .setHeaders({ 'X-Request-ID': 'abc123' })
  .setBearerToken('eyJhbGc...')
  .execute();
```

**Methods:**
- `.setBody(object)` — Set request body (object auto-serialized to JSON)
- `.setQueryParams(object)` — Set query string parameters
- `.setHeaders(object)` — Set custom headers
- `.setBearerToken(token)` — Set Authorization: Bearer header
- `.setPathParam(key, value)` — Replace path parameter (e.g., `/users/{id}`)
- `.execute()` — Send request and return response

### 3. Contract Validation with AJV

Validates response against OpenAPI schema:

```typescript
const response = await apiClient.builder(spec, 'GET', '/users/123').execute();
await contractValidator.validate(response, spec, 'GET', '/users/{id}');
```

**What it checks:**
- HTTP status code matches spec (200, 201, 400, 404, 500, etc.)
- Response headers match spec requirements
- Response body conforms to schema definition
- Required fields are present
- Field types match (string, number, boolean, array, object)
- Additional properties constraints respected

**On validation failure:** Throws with detailed diff of expected vs. actual

### 4. Response Assertions

```typescript
expect(response.status).toBe(200);
expect(response.body).toHaveProperty('id');
expect(response.body.name).toBe('John');
expect(response.headers['content-type']).toContain('application/json');
```

**Response object:**
```typescript
{
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;  // parsed JSON
  rawBody: string;
  duration: number;  // milliseconds
}
```

## Common Test Patterns

### Happy-Path Test (Success Scenario)

```typescript
test('POST /users - create user successfully', async ({ apiClient, contractValidator }) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  
  const response = await apiClient.builder(spec, 'POST', '/users')
    .setBody({
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    })
    .execute();
  
  expect(response.status).toBe(201);
  await contractValidator.validate(response, spec, 'POST', '/users');
  expect(response.body).toHaveProperty('id');
  expect(response.body.name).toBe('John Doe');
});
```

### Error Scenario Test (Validation Failure)

```typescript
test('POST /users - error on missing required field', async ({ apiClient }) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  
  const response = await apiClient.builder(spec, 'POST', '/users')
    .setBody({ name: 'John Doe' })  // missing email
    .execute();
  
  expect(response.status).toBe(400);
  expect(response.body.errors).toContainEqual(
    expect.objectContaining({ field: 'email', message: 'Email is required' })
  );
});
```

### Parameterized Test (Data-Driven)

```typescript
test.each([
  { email: 'valid@example.com', isValid: true },
  { email: 'invalid-email', isValid: false },
  { email: '', isValid: false }
])('POST /users - validate email format', async ({ email, isValid }, { apiClient, contractValidator }) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  
  const response = await apiClient.builder(spec, 'POST', '/users')
    .setBody({ name: 'John', email })
    .execute();
  
  if (isValid) {
    expect(response.status).toBe(201);
    await contractValidator.validate(response, spec, 'POST', '/users');
  } else {
    expect(response.status).toBe(400);
  }
});
```

### Path Parameter Test

```typescript
test('GET /users/{id} - retrieve specific user', async ({ apiClient, contractValidator, runtimeStore }) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  const userId = await runtimeStore.get('userId');  // from previous test
  
  const response = await apiClient.builder(spec, 'GET', '/users/{id}')
    .setPathParam('id', userId)
    .execute();
  
  expect(response.status).toBe(200);
  await contractValidator.validate(response, spec, 'GET', '/users/{id}');
});
```

### Authentication Test

```typescript
test('GET /users - requires bearer token', async ({ apiClient }) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  
  // Without token
  const noTokenResponse = await apiClient.builder(spec, 'GET', '/users').execute();
  expect(noTokenResponse.status).toBe(401);
  
  // With token
  const withTokenResponse = await apiClient.builder(spec, 'GET', '/users')
    .setBearerToken('valid-token')
    .execute();
  expect(withTokenResponse.status).toBe(200);
});
```

### Chained Test (Using Runtime Store)

```typescript
test('POST /users - create, then GET, then UPDATE', async ({ 
  apiClient, contractValidator, runtimeStore 
}) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  
  // 1. Create user
  const createResponse = await apiClient.builder(spec, 'POST', '/users')
    .setBody({ name: 'John', email: 'john@example.com' })
    .execute();
  expect(createResponse.status).toBe(201);
  
  // Store the ID for next step
  const userId = createResponse.body.id;
  await runtimeStore.set('userId', userId);
  
  // 2. Get user
  const getResponse = await apiClient.builder(spec, 'GET', '/users/{id}')
    .setPathParam('id', userId)
    .execute();
  expect(getResponse.status).toBe(200);
  expect(getResponse.body.name).toBe('John');
  
  // 3. Update user
  const updateResponse = await apiClient.builder(spec, 'PUT', '/users/{id}')
    .setPathParam('id', userId)
    .setBody({ name: 'Jane' })
    .execute();
  expect(updateResponse.status).toBe(200);
  await contractValidator.validate(updateResponse, spec, 'PUT', '/users/{id}');
});
```

### Response Header Validation

```typescript
test('GET /users - check response headers', async ({ apiClient }) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  
  const response = await apiClient.builder(spec, 'GET', '/users').execute();
  
  expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
  expect(response.headers['x-total-count']).toBeDefined();
  expect(parseInt(response.headers['x-total-count'])).toBeGreaterThan(0);
});
```

### Query Parameter Test

```typescript
test('GET /users - filter and pagination', async ({ apiClient, contractValidator }) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  
  const response = await apiClient.builder(spec, 'GET', '/users')
    .setQueryParams({
      role: 'admin',
      limit: 10,
      offset: 0
    })
    .execute();
  
  expect(response.status).toBe(200);
  await contractValidator.validate(response, spec, 'GET', '/users');
  expect(Array.isArray(response.body.data)).toBe(true);
  expect(response.body.data.length).toBeLessThanOrEqual(10);
});
```

## Test Data Integration

Use `dataProvider` to load test data for API tests:

```typescript
test('POST /users - with external test data', async ({ apiClient, contractValidator, dataProvider }) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  const testData = await dataProvider.load('test-data-users');
  
  const response = await apiClient.builder(spec, 'POST', '/users')
    .setBody(testData)
    .execute();
  
  expect(response.status).toBe(201);
  await contractValidator.validate(response, spec, 'POST', '/users');
});
```

**Test data file** (`test-data/test-data-users.json`):
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30,
  "country": "USA"
}
```

## Error Handling & Retry

```typescript
test('POST /users - retry on transient failure', async ({ apiClient }) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  let response;
  let retries = 3;
  
  while (retries > 0) {
    try {
      response = await apiClient.builder(spec, 'POST', '/users')
        .setBody({ name: 'John', email: 'john@example.com' })
        .execute();
      
      if (response.status < 500) break;  // Not a server error, stop retrying
      retries--;
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
    }
  }
  
  expect(response.status).toBe(201);
});
```

## Best Practices

1. **Always validate against spec** — don't rely on manual assertions for schema validation
2. **Test both happy-path and error scenarios** — ensure error messages are clear
3. **Use parameter tokens for dynamic data** — `{{TODAY+5}}` in test data avoids hardcoded dates
4. **Store IDs in runtime store** — chain tests without duplicating setup
5. **Check response times** — use `response.duration` to detect performance issues
6. **Group related tests by endpoint** — organize by HTTP method + path

## Related Skills

- **test-generation** — Auto-scaffold API test suites from OpenAPI specs
- **web-testing** — Patterns for browser automation and form population
- **bdd-testing** — Gherkin-based API scenario tests

## Quick Links

- **Framework API Module:** `src/api/`
- **Sample API Tests:** `tests/api/api-contract.spec.ts`
- **OpenAPI Specs:** `specs/openapi/`
- **Test Data:** `test-data/`
