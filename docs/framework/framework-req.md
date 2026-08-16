
# Enterprise Playwright Framework Requirements

## Overview
This framework is intended to test and validate a suite of web and API applications in a spec-driven development model. It should support both traditional automation approaches and AI-assisted capabilities where available. The framework must be usable with or without an AI assistant, and AI features should remain optional and modular.

## Objectives
- Provide a scalable and maintainable test automation framework for web and API applications.
- Support shift-left quality validation through early, automated checks in the development lifecycle.
- Enable collaboration between engineering, QA, and business teams through reusable test assets.
- Ensure secure, observable, and environment-aware test execution.

## Technology Stack
- Playwright
- TypeScript
- Node.js

## Core Capabilities

### API Testing
- Support Swagger and OpenAPI-based test design and validation.
- Perform API contract validation for request and response payloads.
- Validate status codes, schemas, required fields, response times and error-handling scenarios.
- Provide reusable helpers for API request composition and validation.

### Web Testing
- Support standard Playwright-based test execution.
- Support ActionBuilder-style execution for structured and reusable workflows.
- Implement Playwright listeners and hooks for reporting, tracing, and orchestration.
- Support data-and-locator-driven form population for structured page fill workflows (see **Form Populator** below).

## Core Framework Requirements
- Support parallel execution with multiple workers.
- Support multiple test environments.
- Allow environment-specific configuration for both global and test-specific data.
- Support dynamic parameter and variable replacement across test data files.
- Provide built-in handling for date-based values, including present, past, and future dates.
- Support data-driven execution using JSON, CSV, text, and environment-based input files.
- Maintain a runtime data store for session-scoped and environment-scoped values that can be written during test execution and referenced in subsequent steps or test data files.

## Test Data and Locator Assets

The framework must support separate, reusable JSON assets for test data and locator metadata. Test data keys map to locator keys so pages can be populated without hard-coding selectors in test scripts.

### Test Data Files

Test data files contain field values keyed by element or business field name. Values may be static or use dynamic parameter tokens resolved at runtime.

**Example — Sign Up (`test-data-signup.json`):**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "JohnDoe@mailinator.com",
  "age": "21",
  "gender": "male",
  "country": "India"
}
```

**Example — Travel (`test-data-travel.json`):**

```json
{
  "acknowledgement": "{{acknowledgement-no-generated-in-current-session}}",
  "visaDate": "{{TODAY-20}}",
  "startDate": "{{TODAY+10}}",
  "endDate": "{{TODAY+365}}"
}
```

**Requirements:**
- Keys in test data must align with keys in the corresponding locator file (or Form.io element IDs).
- Support parameter tokens for date offsets (`{{TODAY+N}}`, `{{TODAY-N}}`) and runtime store references (`{{key-name}}`).
- Skip population for fields with empty, null, or undefined values when configured to do so.

### Locator Metadata Files

Locator files define how each test-data key maps to a page element and what interaction type to perform.

**Example — Sign Up (`locators-signup.json`):**

```json
{
  "firstName": { "locator": "xpath-to-firstName", "type": "textbox" },
  "lastName":  { "locator": "css-to-lastname",    "type": "textbox" },
  "email":     { "locator": "regex-to-email",     "type": "textbox" },
  "age":       { "locator": "getByLabel('Age')",  "type": "textbox" },
  "gender":    { "locator": "xxxxx",              "type": "radio" },
  "country":   { "locator": "xxxxx",              "type": "dropdown" }
}
```

**Supported field types:**

| Type | Interaction |
|------|-------------|
| `textbox` | Fill text input |
| `textarea` | Fill multi-line input |
| `dropdown` | Select option |
| `radio` | Select radio option |
| `checkbox` | Check or uncheck |
| `click` | Click element (action-only; no value required) |
| `wait` | Wait for selector, state, or timeout |

**Requirements:**
- Locator values must support Playwright locator strategies (CSS, XPath, role, label, text, regex, and accessibility-based locators).
- Locator entries may include optional `before` and `after` action sequences (click, wait, scroll) to handle multi-step UI flows during population.
- When no explicit locator is provided and the key matches a Form.io element ID, the framework must default to `#${fieldKey}`.

### Runtime Data Store

The runtime data store holds values generated or retrieved during test execution. It is scoped by environment and supports both global and test- or suite-specific namespaces.

**Example (`runTimeDataStore.json`):**

```json
{
  "dev": {
    "global": {
      "token": "",
      "baseUrl": ""
    },
    "travel": {
      "acknowledgement-no-generated-in-current-session": 12345
    },
    "test_1": {
      "id": "dynamic-id-1"
    },
    "test_2": {
      "id": "dynamic-id-2"
    }
  },
  "qa": {
    "global": {
      "token": "",
      "baseUrl": ""
    },
    "test_1": {
      "id": "dynamic-id-1"
    },
    "test_2": {
      "id": "dynamic-id-2"
    }
  }
}
```

**Requirements:**
- Load store for the active environment (`dev`, `qa`, etc.) at test start.
- Allow tests to read and write values at runtime (e.g., store a generated acknowledgement number under `travel.acknowledgement-no-generated-in-current-session`).
- Resolve `{{key-name}}` tokens in test data from the runtime store for the current session.
- Persist updates in memory for the duration of the test run; optional file write-back for cross-run state when configured.

## Form Populator

The framework must provide a reusable method (e.g., `formPopulator`) that accepts locator metadata and test data as arguments and populates a page based on field type and value validity.

**Functional requirements:**
- Accept `(page, locators, testData, options?)` and iterate matching keys.
- Populate only when test data contains a valid, non-empty value for the key.
- Select the correct Playwright interaction based on the locator `type` (textbox, dropdown, radio, checkbox, etc.).
- Support interleaved actions (click, wait) via optional `before` / `after` steps on locator entries.
- Integrate with the parameter engine so tokens like `{{TODAY+10}}` and `{{acknowledgement-no-generated-in-current-session}}` are resolved before population.
- Provide configurable error handling: fail, skip, or warn on missing locators or interaction failures.

**Form.io support:**
- Form.io pages assign unique IDs to each element. The same ID must be usable as the key in both test-data and locator JSON files.
- When locator metadata is omitted for a key, auto-resolve using the Form.io element ID convention (`#${fieldKey}`).

**Example usage:**

```typescript
const testData = await dataProvider.load('test-data-signup');
const locators = await dataProvider.load('locators-signup');
await page.goto('/register');
await formPopulator(page, locators, testData);
```

## Utility Requirements

### Data and File Utilities
- Provide robust JSON utilities for reading, writing, updating, deleting, and transforming JSON content.
- Provide generic file utilities for handling text, CSV, JSON, and environment files.
- Support test data handling as a primary use case for these utilities.
- Provide utilities to zip and unzip files and folders for packaging, archive creation, and artifact collection.

### Encoding and Decoding
- Provide utilities to encode and decode sensitive values such as passwords or tokens.

### Date and Time Utilities
- Generate current, past, and future dates.
- Convert dates between different formats.
- Support date formatting for test data generation and validation.

### Playwright-Specific Utilities
- Capture traces, screenshots, and snapshots.
- Record network activity with optional filtering.
- Support artifact storage for debugging and evidence collection.
- Ensure all framework-generated artifacts, including logs, traces, screenshots, snapshots, and network captures in formats such as cURL, JSON, and Node.js-compatible representations, are written to a configurable output directory.
- Support a user-configurable OUTPUT_DIR with subfolders for organizing artifacts by type, execution run, environment, or test suite.

### Email Utilities
- Connect to email platforms such as Microsoft 365 or Google Workspace.
- Read messages, download attachments, and parse HTML content when required.

## Logging and Security
- Support configurable logging through global environment variables and per-file options.
- Redact sensitive values such as passwords and secrets in logs and reports.
- Support secure handling of credentials and sensitive test data.
- Integrate dependency and code scanning capabilities to identify potential security vulnerabilities.

## Performance and Quality Validation
- Support Lighthouse-based performance validation.
- Support accessibility testing using Axe DevTools or similar tools.
- Support additional quality checks such as visual regression and performance assertions where needed.

## BDD and Collaboration Support
- Provide support for Behavior-Driven Development (BDD) workflows for teams that prefer Gherkin-style scenarios.
- Ensure test artifacts remain readable and useful for both technical and non-technical stakeholders.

## CI/CD and Quality Gates
- Integrate with major CI/CD platforms such as Jenkins, Azure Pipelines, and GitHub Actions.
- Support quality gates to enable shift-left validation in spec-driven delivery.

## AI Integration
When AI capabilities are available, the framework should optionally support:
- Generation of test data.
- Creation of mock responses.
- Locator healing and maintenance.
- Script generation and test suggestion.

These AI features should be modular, configurable, and non-blocking so the framework can operate effectively even without AI assistance.

