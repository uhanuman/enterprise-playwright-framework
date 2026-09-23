# Enterprise Playwright Test Automation Framework

A layered, spec-driven Playwright framework for web + API + quality testing with config-driven parameters, runtime data store, artifact management, BDD support, security scanning, and optional AI helpers.

## Features

- **Extended `test` / `expect`** from `src/framework/testBase.ts` — fixtures for config, logger, artifacts, runtime store, data provider, API client, contract validator, ActionBuilder, and FormPopulator, plus auto hooks (network recording, failure screenshots, test-info artifacts).
- **Config manager** — multi-environment JSON config (`config/defaults.json` + `config/environments/<env>.json`) overlaid by env vars.
- **Parameter engine** — resolves `{{TODAY±N}}`, `{{DATE:fmt:offset}}`, `{{ENV.*}}`, `{{RUNTIME.*}}`, `{{CONFIG.*}}`, `{{RUN_ID}}` tokens in test data and steps.
- **Runtime store** — env-scoped global + per-test dynamic values, queryable by dot path or flat key.
- **Data provider** — global + environment JSON merge, CSV, plain text, env vars, and locator maps (`load`, `loadJson`, `loadCsv`, `loadText`, `loadEnv`, `loadLocators`).
- **Web testing** — fluent `ActionBuilder` (executable + exportable/replayable step queues), `FormPopulator` (locator + test-data driven fill with Form.io `#id` convention), network/trace/screenshot listeners.
- **API testing** — OpenAPI/Swagger spec loader (with `$ref` dereferencing), `ApiClient` operation builders, AJV contract validator, response assertions.
- **Quality** — Lighthouse (via `playAudit`), Axe accessibility, visual regression (`toHaveScreenshot`) runners.
- **Email** — provider interface with Microsoft 365 (Graph OAuth client-credentials) and Google Workspace (Gmail refresh-token) implementations.
- **JSON utilities** — parse, transform, query (jsonpath), patch, validate, security/redaction, and IO helpers.
- **BDD** — playwright-bdd with a sample feature; steps receive the framework fixtures.
- **CI/CD** — GitHub Actions, Azure Pipelines, Jenkins templates; `quality:gate` and `security:scan` scripts.
- **Optional AI** — test data generator, mock response builder, locator healer, script suggester, gated behind `ENABLE_AI=true` (zero runtime cost when off).

## Getting Started

```bash
npm install
npx playwright install chromium
npm test            # run the Playwright sample suite (14 tests)
npm run test:bdd    # run the Gherkin sample suite (2 tests)
```

Copy `.env.example` to `.env` and adjust. See [Environment variables](#environment-variables).

### Run in Docker

The repository includes a pinned Playwright image and a Compose service. Build the image and run the default suite with:

```bash
docker compose up --build --abort-on-container-exit --exit-code-from playwright
```

Run the BDD suite instead:

```bash
docker compose run --rm playwright npm run test:bdd
```

Test reports and artifacts are written to the host `output/` directory. For an application running on the host, the default Docker URLs use `host.docker.internal`; override `BASE_URL` or `API_BASE_URL` when the application runs in another container or environment.

## Project Layout

```
src/
  config/          config manager + runtime data store
  logging/         pino logger with redaction
  framework/       testBase, hooks (auto fixtures), dataProvider, artifactManager
  utils/           file, csv, zip, encode, output, date, parameters
  utils/json/      parse, transform, query, patch, validate, security, io
  web/             actionBuilder, basePage, formPopulator, listeners/
  api/             specLoader, apiClient, contractValidator, responseAssertions
  quality/         lighthouseRunner, axeRunner, visualRegression
  security/        npm-audit based scan
  utils/email/     provider, microsoft365, googleWorkspace
  ai/              provider, testDataGenerator, mockResponseBuilder, locatorHealer, scriptSuggester
  index.ts         public barrel
tests/
  samples/         framework capabilities + API client samples
  web/             ActionBuilder + FormPopulator samples
  api/             OpenAPI contract validation sample (local server)
  steps/           BDD step definitions
features/          Gherkin features
specs/openapi/     sample OpenAPI spec
test-data/         JSON/CSV test data + locator maps
scripts/           quality-gate, security-scan, generate-api-tests
output/            run artifacts (traces, screenshots, network, logs, reports)
```

## Writing Tests

```typescript
import { test, expect } from '../src/framework/testBase';

test('user registration @web', async ({ page, formPopulator, dataProvider }) => {
  const testData = await dataProvider.load('test-data-signup');
  const locators = await dataProvider.load('locators-signup');
  await page.goto('/register');
  await formPopulator(page, locators, testData);
  await expect(page.locator('.success')).toBeVisible();
});
```

```typescript
test('user login @web', async ({ actionBuilder, dataProvider }) => {
  const data = await dataProvider.load('user-login');
  await actionBuilder()
    .navigate('/login')
    .fill('#email', data.email)
    .fill('#password', data.password)
    .click('#submit')
    .assertVisible('.dashboard')
    .execute();
});
```

```typescript
test('POST /users returns 201 @api', async ({ apiClient, contractValidator }) => {
  const response = await apiClient.operation('createUser').withBody({ name: 'Ada' }).send();
  await contractValidator.assertValid(response);
  expect(response.status()).toBe(201);
});
```

## BDD

```gherkin
Feature: User login
  Scenario: Valid credentials
    Given I am on the login page
    When I login with valid credentials
    Then I should see the dashboard
```

- Features live in `features/`, steps in `tests/steps/`.
- `playwright.bdd.config.ts` wires features, steps, and the framework `test` instance (`importTestFrom: './src/framework/testBase.ts'`).
- `npm run test:bdd` regenerates and runs the compiled specs.

## Environment Variables

| Variable         | Default                   | Purpose                                    |
| ---------------- | ------------------------- | ------------------------------------------ |
| `ENVIRONMENT`    | `dev`                     | Active environment (`dev`/`qa`/`prod`)     |
| `OUTPUT_DIR`     | `output`                  | Artifact output root                       |
| `LOG_LEVEL`      | `info`                    | Log verbosity                              |
| `REDACT_SECRETS` | `true`                    | Redact secrets in logs                     |
| `WORKERS`        | `4`                       | Parallel workers                           |
| `BASE_URL`       | `http://localhost:3000`   | Web app base URL                           |
| `API_BASE_URL`   | `http://localhost:8080/api` | API base URL                             |
| `ENABLE_AI`      | `false`                   | Enable AI modules                          |
| `AI_API_KEY`     | —                         | AI provider key (when `ENABLE_AI=true`)    |
| `AI_API_URL`     | —                         | AI provider base URL                       |

## Scripts

| Script                       | Description                                              |
| ---------------------------- | -------------------------------------------------------- |
| `npm run test`               | Run Playwright sample suite                              |
| `npm run test:bdd`           | Run BDD suite                                            |
| `npm run test:headed`        | Run headed                                               |
| `npm run lint`               | Typecheck (`tsc --noEmit`)                               |
| `npm run quality:gate`       | Typecheck + test + lint gate (see `scripts/quality-gate.ts`) |
| `npm run security:scan`      | `npm audit` gate; fails above threshold                  |
| `npm run generate:api-tests` | Scaffold API tests from an OpenAPI spec                  |
| `npm run build`              | Emit compiled output                                     |

Example: `npm run generate:api-tests -- --spec specs/openapi/sample.yaml` writes scaffolds to `generated/api-tests`.

## Security Scan

`npm run security:scan` parses `npm audit --json` and fails when high/critical vulnerabilities exceed the threshold. Override with:

```bash
SECURITY_MAX_HIGH_CRITICAL=2 npm run security:scan
```

Note: the current sample suite intentionally reports 4 high transitive vulnerabilities (lighthouse/puppeteer chain); set the threshold accordingly in CI or exclude dev-only dependencies from your gate policy.

## Quality Gates & CI

- `.github/workflows/ci.yml`, `azure-pipelines.yml`, `Jenkinsfile` run install → typecheck → test → BDD → quality gate → security scan.
- Gates run against a green sample suite and pass without a live server.

## Optional AI

With `ENABLE_AI=true` and a valid `AI_API_KEY`/`AI_API_URL`, `src/ai/` exposes:

- `generateTestData` — synthetic test data from a schema
- `buildMockResponse` — mock API responses
- `healLocator` — locator suggestions for failing selectors
- `suggestScript` — recommended Playwright snippets

With AI disabled (default) these modules are never loaded.

## Documentation

- `docs/framework/framework-req.md` — formal requirements
- `docs/framework/framework-design-plan.md` — architecture, phases, checklist