# Enterprise Playwright Framework — Copilot Instructions

This document encodes conventions and key patterns for the Enterprise Playwright Test Automation Framework. Use this as context when working on framework code, tests, or tooling.

## Project Overview

**Purpose:** Layered, spec-driven Playwright automation framework for web + API + quality testing with config-driven parameters, runtime data store, artifact management, BDD support, security scanning, and optional AI helpers.

**Tech Stack:** Playwright, TypeScript, Node.js  
**Repository:** `enterprise-playwright-framework`  
**Entry Point:** `src/index.ts` (barrel export) | `src/framework/testBase.ts` (test fixtures)

## Folder Structure & Responsibilities

```
src/
  config/        ConfigManager (env overlay), RuntimeStore (session/test scoped values)
  framework/     testBase (extended fixtures), globalSetup/hooks, dataProvider, artifactManager
  logging/       pino logger with sensitive-data redaction
  utils/         file, csv, zip, encode, output, date, parameters (token replacement)
  utils/json/    parse, transform, query (jsonpath), patch, validate, security, io
  web/           ActionBuilder (fluent step queues), basePage, FormPopulator, listeners
  api/           specLoader (OpenAPI deref), apiClient, contractValidator, responseAssertions
  quality/       lighthouseRunner, axeRunner, visualRegression
  security/      npm-audit scan
  utils/email/   provider interface, microsoft365 (OAuth), googleWorkspace (Gmail refresh-token)
  ai/            provider, testDataGenerator, mockResponseBuilder, locatorHealer, scriptSuggester (gated ENABLE_AI)

test-data/       JSON/CSV test data + locator metadata maps
specs/openapi/   OpenAPI/Swagger specs for API contract validation
tests/
  samples/       framework capabilities + API client samples
  web/           ActionBuilder + FormPopulator page interaction samples
  api/           OpenAPI contract validation sample (runs local server)
  steps/         BDD step definitions (Gherkin → Playwright)
features/        Gherkin .feature files for BDD
output/          generated run artifacts (traces, screenshots, network, logs, reports, test-results)
```

## Core Patterns & Conventions

### Test Data & Locators

**Test data files** (`test-data/<name>.json`) contain field values keyed by logical field/element name:
```json
{
  "firstName": "John",
  "email": "john@example.com",
  "visaDate": "{{TODAY-20}}",
  "acknowledgement": "{{acknowledgement-no-generated-in-current-session}}"
}
```

**Locator files** (`test-data/locators-<name>.json`) map test-data keys to page elements + interaction type:
```json
{
  "firstName": { "locator": "input[name='firstName']", "type": "textbox" },
  "email": { "locator": "getByLabel('Email')", "type": "textbox" },
  "country": { "locator": "select#country", "type": "dropdown" }
}
```

**Interaction types:** `textbox`, `textarea`, `radio`, `checkbox`, `dropdown`, `button`, `file`, etc.

**Parameter tokens** resolved at runtime:
- `{{TODAY±N}}` — date offset from today (e.g., `{{TODAY+10}}`, `{{TODAY-20}}`)
- `{{DATE:fmt:offset}}` — formatted date (e.g., `{{DATE:yyyy-MM-dd:5}}`)
- `{{ENV.VAR_NAME}}` — environment variable
- `{{RUNTIME.key}}` or `{{key}}` — runtime data store value
- `{{CONFIG.section.key}}` — config value
- `{{RUN_ID}}` — unique test run ID

### Extended Test Fixtures (testBase.ts)

All tests inherit from `testBase`:

```typescript
import { test, expect } from '../src/framework/testBase';

test('my test', async ({
  page,
  logger,
  configManager,
  runtimeStore,
  dataProvider,
  artifactManager,
  actionBuilder,
  formPopulator,
  apiClient,
  contractValidator
}) => {
  // All fixtures are injected automatically
});
```

**Key fixtures:**
- `page` — Playwright Page object (enhanced with network/trace listeners auto-attached)
- `logger` — pino logger with auto-redaction of secrets
- `configManager` — env + default config overlay
- `runtimeStore` — get/set session or per-test values
- `dataProvider` — load JSON, CSV, env, or locator maps
- `artifactManager` — save logs, screenshots, traces to output folder
- `actionBuilder` — fluent web interaction API (executable + replayable)
- `formPopulator` — locator + test-data driven form fill
- `apiClient` — OpenAPI/Swagger operation builder
- `contractValidator` — AJV-based payload validation

### ActionBuilder Pattern (Web Testing)

Fluent, step-queued API for readable and replayable web flows:

```typescript
const result = await actionBuilder()
  .navigate('/login')
  .fill('#email', 'user@example.com')
  .fill('#password', 'pass')
  .click('button[type="submit"]')
  .waitFor('nav.success')
  .screenshot('login_success')
  .getSteps();  // export for replay/documentation
```

Steps are queued and executed in order. Errors halt and capture state. Use `.getSteps()` to export for docs/replay.

### FormPopulator Pattern (Web Testing)

Data-driven form population using test-data + locator maps:

```typescript
const testData = await dataProvider.load('test-data-signup');
const locators = await dataProvider.load('locators-signup');
await formPopulator(page, locators, testData);
```

FormPopulator:
- Skips fields with empty/null/undefined values by default
- Supports Form.io `#element-id` convention for field mapping
- Handles multiple interaction types (text, radio, checkbox, dropdown)
- Logs all fills for auditability

### API Testing & Contract Validation

**OpenAPI specs** are loaded with `$ref` dereferencing:

```typescript
const spec = await specLoader.load('specs/openapi/sample.yaml');
const operation = apiClient.builder(spec, 'POST', '/users')
  .setBody({ name: 'John', email: 'john@example.com' })
  .setQueryParams({ notify: true });
const response = await operation.execute();
await contractValidator.validate(response, spec, 'POST', '/users');
```

**Specs location:** `specs/openapi/<spec-name>.yaml` or `.json`  
**Expected responses** are validated against OpenAPI schema; status, headers, and payload are checked.

### Configuration & Environment Management

**Config hierarchy** (highest priority first):
1. Environment variables (e.g., `BASE_URL=...`)
2. Environment-specific JSON (e.g., `config/environments/qa.json`)
3. Defaults JSON (e.g., `config/defaults.json`)

**Access in tests:**
```typescript
const baseUrl = configManager.get('baseUrl');
const apiKey = configManager.getSecret('apiKey');  // redacted in logs
```

### Runtime Data Store

Persist values written during test execution for use in subsequent steps or tests:

```typescript
// Write a value (scoped to current environment + test)
await runtimeStore.set('userId', response.body.id);

// Read it back (supports dot-path access)
const userId = await runtimeStore.get('userId');

// Also works in test-data tokens: {{ RUNTIME.userId }}
```

### Parameters & Date Utilities

Token resolution happens automatically in:
- Test data loads
- Config value lookups
- FormPopulator fills
- ActionBuilder steps

**Date helper examples:**
```typescript
// In test data:
"startDate": "{{TODAY+5}}",      // 5 days from now
"endDate": "{{TODAY+365}}",      // 1 year from now
"pastDate": "{{TODAY-30}}",      // 30 days ago
"formatted": "{{DATE:yyyy-MM-dd:10}}"  // formatted offset date
```

## Common Workflows

### Web Test with Form Population

```typescript
test('register user', async ({ page, dataProvider, formPopulator }) => {
  const data = await dataProvider.load('test-data-signup');
  const locators = await dataProvider.load('locators-signup');
  await page.goto('/register');
  await formPopulator(page, locators, data);
  await expect(page.locator('.success-msg')).toBeVisible();
});
```

### API Contract Test

```typescript
test('list users contract', async ({ apiClient, contractValidator }, specLoader) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  const response = await apiClient.builder(spec, 'GET', '/users')
    .setQueryParams({ limit: 10 })
    .execute();
  await contractValidator.validate(response, spec, 'GET', '/users');
});
```

### Data-Driven Web Test (CSV)

```typescript
test('login with multiple credentials', async ({ page, dataProvider }) => {
  const users = await dataProvider.loadCsv('test-data/users.csv');
  for (const user of users) {
    await page.goto('/login');
    await page.fill('#email', user.email);
    await page.fill('#password', user.password);
    await page.click('button[type="submit"]');
    await expect(page.locator('nav')).toBeVisible();
  }
});
```

### BDD Test (Gherkin)

```feature
Feature: User Login
  Scenario: Successful login with valid credentials
    Given the user is on the login page
    When the user enters valid credentials
    Then the user should see the dashboard
```

Steps receive framework fixtures automatically via the `Given`/`When`/`Then` step definitions in `tests/steps/`.

### Quality Gate (Lighthouse + Axe)

```typescript
test('homepage accessibility', async ({ page, lighthouseRunner, axeRunner }) => {
  await page.goto('/');
  const lh = await lighthouseRunner(page, { categories: ['performance', 'accessibility'] });
  expect(lh.lighthouseResult.categories.accessibility.score).toBeGreaterThan(0.9);
  
  const axe = await axeRunner(page);
  expect(axe.violations).toEqual([]);
});
```

## Best Practices

1. **Keep test data separate from test code** — use `test-data/` and `dataProvider.load()` for all external values.
2. **Use parameter tokens in test data** — `{{TODAY+5}}` is more maintainable than hardcoded dates.
3. **Leverage ActionBuilder for readability** — fluent steps + `.getSteps()` export make tests self-documenting.
4. **Validate against OpenAPI specs** — don't trust API responses without contract validation.
5. **Use locator files for page maintenance** — centralizes selectors; easier to fix when UI changes.
6. **Log and redact** — `logger.info()` auto-redacts secrets defined in config.
7. **Use formPopulator for form fills** — avoids brittle multi-line fill sequences.
8. **Run quality gates in CI** — leverage `npm run quality:gate` and `npm run security:scan`.
9. **BDD for stakeholder collaboration** — Gherkin features in `features/` bridge QA, dev, and business.

## AI Features (Optional)

AI helpers are isolated under `src/ai/` and gated by `ENABLE_AI=true` env var. When disabled, zero runtime cost.

- `testDataGenerator` — suggest test data values for a given spec or schema
- `mockResponseBuilder` — generate mock API responses from OpenAPI schemas
- `locatorHealer` — suggest fixes for broken selectors
- `scriptSuggester` — recommend test steps based on page analysis

Do NOT hardcode AI calls in production tests. Use only for development or in gated feature flows.

## Scripts & Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run Playwright sample suite (14 tests) |
| `npm run test:headed` | Run tests with browser visible |
| `npm run test:bdd` | Run Gherkin feature tests (2 tests) |
| `npm run lint` | Type-check code (no compilation) |
| `npm run security:scan` | Scan `node_modules` for known vulnerabilities |
| `npm run quality:gate` | Run Lighthouse + Axe on sample page |
| `npm run generate:api-tests` | Auto-generate API test suite from OpenAPI spec |

## Environment Variables & Secrets

Copy `.env.example` to `.env` and configure:

```bash
# Framework
BASE_URL=http://localhost:3000
ENV=dev
OUTPUT_DIR=./output
LOG_LEVEL=info

# API (if testing APIs)
API_BASE_URL=https://api.example.com
API_KEY=<secret>

# Email (optional)
OFFICE_365_CLIENT_ID=<secret>
OFFICE_365_CLIENT_SECRET=<secret>
GMAIL_REFRESH_TOKEN=<secret>

# AI (optional)
ENABLE_AI=false
OPENAI_API_KEY=<secret>

# Playwright
HEADED=false
WORKERS=4
```

Secrets are auto-redacted in logs.

## Agents & Skills

This workspace has 21 domain agents (`.github/agents/`) for specialized workflows:
- `@backend-developer` — API implementation
- `@technical-design` — architecture & design decisions
- `@qa-engineer` — test strategy & validation
- `@frontend-developer` — UI/UX implementation
- And 17 more for specialized roles

Invoke directly in chat: `@technical-design Review the ActionBuilder design` or `@qa-engineer Generate test strategy for login flow`.

Custom skills are in `.github/skills/`:
- `test-generation.md` — scaffolds API + Web test suites from specs
- (More skills to follow)

## Quick Links

- **Framework Requirements:** [framework-req.md](../docs/framework/framework-req.md)
- **Design Plan:** [framework-design-plan.md](../docs/framework/framework-design-plan.md)
- **Setup Guide:** [framework-initial-setup.md](../docs/framework/framework-initial-setup.md)
- **Sample Tests:** [tests/samples/](../tests/samples/)
- **BDD Features:** [features/](../features/)
- **Test Data:** [test-data/](../test-data/)
- **OpenAPI Specs:** [specs/openapi/](../specs/openapi/)
