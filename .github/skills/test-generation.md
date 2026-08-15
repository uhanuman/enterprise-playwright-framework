# Skill: Test Generation Pipeline

Scaffolds complete API and Web test suites from OpenAPI specs and page requirements. Use this skill when you need to:
- Generate API test cases from an OpenAPI/Swagger spec
- Create Web test templates using ActionBuilder + FormPopulator patterns
- Bootstrap BDD feature files with step stubs
- Generate test data and locator metadata files

## How to Use This Skill

Ask Copilot: "**Use the test-generation skill to generate API tests for `specs/openapi/sample.yaml`**"

Or for a complete suite:
"**Use test-generation to scaffold Web + API tests for the user registration flow**"

## Inputs

- **OpenAPI Spec Path:** Path to the spec file (e.g., `specs/openapi/users-api.yaml`)
- **Test Type:** `api` (contract + integration), `web` (ActionBuilder + FormPopulator), or `bdd` (Gherkin features)
- **Page/Endpoint:** Target URL or OpenAPI endpoint (e.g., `/register`, `POST /users`)
- **Test Data Scope:** Fields to test (e.g., required fields, edge cases, error scenarios)

## Outputs

The skill generates:

### For API Tests (`generated/api-tests/`)
- **`<method>-<operationId>.spec.ts`** — Contract validation + happy-path + error cases
  - Uses `apiClient` builder + `contractValidator`
  - Includes test data injection from `test-data/`
  - Validates status, schema, required fields, response times

### For Web Tests (`tests/web/`)
- **`<page-name>.spec.ts`** — ActionBuilder + FormPopulator workflows
  - Uses `dataProvider.load()` for test data and locators
  - Includes form fill, validation, and success scenarios
  - Patterns: navigate → populate → submit → assert

### For BDD Features (`features/`)
- **`<feature-name>.feature`** — Gherkin scenarios with step stubs
  - Organized by user journey (Happy path, Error cases, Edge cases)
  - Step definitions linked in `tests/steps/<feature-name>.steps.ts`

### Supporting Assets
- **Test Data:** `test-data/test-data-<feature>.json`
- **Locators:** `test-data/locators-<feature>.json`
- **Config:** Environment-specific config in `config/environments/`

## Patterns Applied

### API Test Template
```typescript
import { test, expect } from '../../src/framework/testBase';
import { specLoader } from '../../src/api';

test('POST /users - create user (happy path)', async ({ apiClient, contractValidator }) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  const response = await apiClient.builder(spec, 'POST', '/users')
    .setBody({ name: 'John Doe', email: 'john@example.com' })
    .execute();
  
  expect(response.status).toBe(201);
  await contractValidator.validate(response, spec, 'POST', '/users');
  expect(response.body).toHaveProperty('id');
});

test('POST /users - error: missing required field', async ({ apiClient }) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  const response = await apiClient.builder(spec, 'POST', '/users')
    .setBody({ name: 'John Doe' })  // missing email
    .execute();
  
  expect(response.status).toBe(400);
  expect(response.body.errors).toContain('email is required');
});
```

### Web Test Template
```typescript
import { test, expect } from '../../src/framework/testBase';

test('register user with ActionBuilder', async ({ page, actionBuilder, dataProvider }) => {
  const data = await dataProvider.load('test-data-signup');
  await actionBuilder()
    .navigate('/register')
    .fill('#firstName', data.firstName)
    .fill('#email', data.email)
    .click('button[type="submit"]')
    .waitFor('.success-message')
    .screenshot('registration_success')
    .execute();
  
  await expect(page.locator('.success-message')).toBeVisible();
});

test('register user with FormPopulator', async ({ page, formPopulator, dataProvider }) => {
  const testData = await dataProvider.load('test-data-signup');
  const locators = await dataProvider.load('locators-signup');
  await page.goto('/register');
  await formPopulator(page, locators, testData);
  await expect(page.locator('.success-message')).toBeVisible();
});
```

### Test Data Template
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@mailinator.com",
  "age": "25",
  "country": "USA",
  "startDate": "{{TODAY+5}}",
  "endDate": "{{TODAY+365}}"
}
```

### Locator Template
```json
{
  "firstName": { "locator": "input[name='firstName']", "type": "textbox" },
  "lastName": { "locator": "input[name='lastName']", "type": "textbox" },
  "email": { "locator": "input[type='email']", "type": "textbox" },
  "country": { "locator": "select#country", "type": "dropdown" },
  "submitBtn": { "locator": "button[type='submit']", "type": "button" }
}
```

### BDD Feature Template
```gherkin
Feature: User Registration

  Background:
    Given the registration page is loaded

  Scenario: Successful registration with valid data
    When the user enters valid registration data
    And the user clicks the submit button
    Then the user should see a success message
    And a new user account should be created

  Scenario: Error on missing required field
    When the user enters incomplete data
    And the user clicks the submit button
    Then the user should see an error message
    And no account should be created

  Scenario Outline: Register with multiple data sets
    When the user registers with "<firstName>" and "<email>"
    Then the registration should <result>

    Examples:
      | firstName | email              | result  |
      | John      | john@example.com   | succeed |
      | Jane      | jane@example.com   | succeed |
      |           | invalid@example    | fail    |
```

## Test Case Coverage

The skill generates tests covering:

**API:**
- ✅ Happy-path (successful operation with valid input)
- ✅ Contract validation (schema, required fields, types)
- ✅ Status codes (200, 201, 400, 401, 404, 500 as applicable)
- ✅ Error scenarios (missing required fields, invalid formats)
- ✅ Response time assertions

**Web:**
- ✅ Navigation to page
- ✅ Form population with test data
- ✅ Submit/action triggers
- ✅ Success/error message validation
- ✅ Data persistence in runtime store (if applicable)

**BDD:**
- ✅ Happy-path scenarios
- ✅ Error/edge-case scenarios
- ✅ Parameterized examples (data-driven via Examples table)
- ✅ Linked step definitions in `tests/steps/`

## Test Data & Parameter Tokens

Generated tests include support for:
- `{{TODAY±N}}` — dynamic date offsets
- `{{RUNTIME.key}}` — values from previous test steps
- `{{CONFIG.section.key}}` — config values
- `{{ENV.VAR_NAME}}` — environment variables

Example in test data:
```json
{
  "startDate": "{{TODAY+5}}",
  "endDate": "{{TODAY+365}}",
  "referenceId": "{{RUNTIME.userId}}"
}
```

## File Organization

Generated files follow the workspace layout:

```
generated/api-tests/        Generated API test specs
tests/web/                  Generated Web test specs
tests/steps/                Generated BDD step definitions
features/                   Generated Gherkin features
test-data/                  Generated test data + locators
config/environments/        Generated environment configs
```

## Quick Start Example

1. **Ask Copilot:** "Use test-generation to scaffold API tests for the user creation endpoint in `specs/openapi/sample.yaml`"
   - Copilot generates `generated/api-tests/post-createUser.spec.ts`
   - Also creates `test-data/test-data-users.json` + `test-data/locators-users.json`

2. **Run the tests:** `npm test generated/api-tests/post-createUser.spec.ts`

3. **Customize:** Edit generated files to add business logic, additional assertions, or error scenarios.

## Integration with CI/CD

The `npm run generate:api-tests` script auto-generates tests from OpenAPI specs:

```bash
npm run generate:api-tests
```

This populates `generated/api-tests/` with a full test suite, then runs it:

```bash
npm test generated/api-tests/**
```

See `scripts/generate-api-tests.ts` for customization.

## Related Commands

- `npm test` — Run all generated + hand-written tests
- `npm run test:bdd` — Run BDD feature tests
- `npm run quality:gate` — Run Lighthouse + Axe on generated Web tests
- `npm run security:scan` — Scan for vulnerabilities in generated dependencies
