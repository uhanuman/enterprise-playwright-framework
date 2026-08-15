# Skill: Web Testing Patterns

Comprehensive patterns for browser automation using ActionBuilder, FormPopulator, and Playwright listeners. Use this skill when:
- Creating fluent, reusable web test workflows
- Populating forms with test data and locators
- Building page-level test abstractions
- Handling user interactions (clicks, fills, waits)
- Capturing network traces and failure screenshots
- Testing multi-step user journeys

## How to Use This Skill

Ask Copilot: "**Use web-testing to create an ActionBuilder test for the login flow**"

Or for form filling:
"**Use web-testing to generate a FormPopulator test for user registration**"

## Core Components

### 1. ActionBuilder — Fluent Step Execution

Fluent, step-queued API for readable and replayable web flows:

```typescript
import { test } from '../../src/framework/testBase';

const result = await actionBuilder()
  .navigate('/login')
  .fill('#email', 'user@example.com')
  .fill('#password', 'password123')
  .click('button[type="submit"]')
  .waitFor('nav.success')
  .screenshot('login_success')
  .execute();
```

**Methods:**
- `.navigate(url)` — Go to page
- `.fill(selector, value)` — Fill input field
- `.click(selector)` — Click element
- `.hover(selector)` — Hover over element
- `.press(key)` — Press keyboard key
- `.waitFor(selector)` — Wait for element visibility
- `.screenshot(name)` — Save screenshot to artifacts
- `.expect(actual).toBe(expected)` — Inline assertion
- `.execute()` — Run all queued steps
- `.getSteps()` — Export steps array for documentation

**Features:**
- Steps are queued and executed in order
- Errors halt execution and capture state (screenshot, trace)
- Each step is logged with timing and status
- Replayable — `.getSteps()` exports structured format for docs/replay

### 2. FormPopulator — Data-Driven Form Filling

Populate forms using test-data and locator-metadata files:

```typescript
import { test } from '../../src/framework/testBase';

test('register user with FormPopulator', async ({ page, formPopulator, dataProvider }) => {
  const testData = await dataProvider.load('test-data-signup');
  const locators = await dataProvider.load('locators-signup');
  
  await page.goto('/register');
  await formPopulator(page, locators, testData);
  await expect(page.locator('.success-msg')).toBeVisible();
});
```

**Features:**
- Skips empty/null/undefined fields (configurable)
- Supports Form.io `#element-id` convention for field mapping
- Handles multiple interaction types: textbox, textarea, radio, checkbox, dropdown, button, file
- Logs all fills for auditability
- Auto-redacts sensitive data in logs

**Test Data Format** (`test-data/test-data-signup.json`):
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "country": "USA",
  "terms": true,
  "startDate": "{{TODAY+5}}"
}
```

**Locator Format** (`test-data/locators-signup.json`):
```json
{
  "firstName": { "locator": "input[name='firstName']", "type": "textbox" },
  "lastName": { "locator": "input[name='lastName']", "type": "textbox" },
  "email": { "locator": "input[type='email']", "type": "textbox" },
  "country": { "locator": "select#country", "type": "dropdown" },
  "terms": { "locator": "input[type='checkbox'][name='terms']", "type": "checkbox" },
  "submit": { "locator": "button[type='submit']", "type": "button" }
}
```

### 3. Listeners — Auto Hooks for Artifacts

Network, trace, and screenshot listeners are auto-attached to all tests via `testBase`:

```typescript
// Automatically captured on every test:
// - Network trace (HAR) → output/<run-id>/<env>/network.har
// - Playwright trace → output/<run-id>/<env>/trace.zip
// - Screenshot on failure → output/<run-id>/<env>/screenshots/
// - Test logs → output/<run-id>/<env>/logs/
```

**Manual screenshot:**
```typescript
await page.screenshot({ path: 'screenshot.png' });
```

**Manual trace:**
```typescript
await context.tracing.start({ screenshots: true, snapshots: true });
// ... test actions ...
await context.tracing.stop({ path: 'trace.zip' });
```

## Common Test Patterns

### Simple Navigation & Assertion

```typescript
test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Welcome');
  await expect(page.locator('nav')).toBeVisible();
});
```

### ActionBuilder Happy-Path

```typescript
test('user login with ActionBuilder', async ({ actionBuilder }) => {
  await actionBuilder()
    .navigate('/login')
    .fill('#email', 'user@example.com')
    .fill('#password', 'password123')
    .click('button[type="submit"]')
    .waitFor('nav.dashboard')
    .screenshot('after_login')
    .execute();
});
```

### FormPopulator Registration

```typescript
test('register user with FormPopulator', async ({ page, formPopulator, dataProvider }) => {
  const testData = await dataProvider.load('test-data-signup');
  const locators = await dataProvider.load('locators-signup');
  
  await page.goto('/register');
  await formPopulator(page, locators, testData);
  
  await expect(page.locator('.success-msg')).toHaveText('Registration successful');
});
```

### Multi-Step Workflow with Runtime Store

```typescript
test('complete user registration and verify email', async ({ 
  page, actionBuilder, formPopulator, dataProvider, runtimeStore, logger
}) => {
  const testData = await dataProvider.load('test-data-signup');
  const locators = await dataProvider.load('locators-signup');
  
  // Step 1: Register
  await page.goto('/register');
  await formPopulator(page, locators, testData);
  await page.click('button[type="submit"]');
  
  // Step 2: Capture confirmation message
  const confirmMsg = await page.locator('.confirm-msg').textContent();
  await runtimeStore.set('confirmationCode', confirmMsg.match(/\d+/)[0]);
  logger.info(`Confirmation code: ${confirmMsg}`);
  
  // Step 3: Navigate to email verification
  await page.goto('/verify-email');
  const code = await runtimeStore.get('confirmationCode');
  await page.fill('#code', code);
  await page.click('button[type="submit"]');
  
  await expect(page.locator('.verified-badge')).toBeVisible();
});
```

### Parameterized Test (Data-Driven)

```typescript
const testCases = [
  { email: 'valid@example.com', isValid: true },
  { email: 'invalid-email', isValid: false },
  { email: '', isValid: false }
];

test.each(testCases)('validate email format', async ({ page, actionBuilder }, { email, isValid }) => {
  await page.goto('/email-validator');
  await page.fill('#email', email);
  await page.click('button[type="submit"]');
  
  if (isValid) {
    await expect(page.locator('.valid-indicator')).toBeVisible();
  } else {
    await expect(page.locator('.error-message')).toBeVisible();
  }
});
```

### Form Validation Error Handling

```typescript
test('form validation errors', async ({ page, formPopulator, dataProvider }) => {
  const incompleteData = await dataProvider.load('test-data-signup');
  incompleteData.email = '';  // Clear required field
  const locators = await dataProvider.load('locators-signup');
  
  await page.goto('/register');
  await formPopulator(page, locators, incompleteData);
  await page.click('button[type="submit"]');
  
  const errorMsg = await page.locator('[role="alert"]').textContent();
  expect(errorMsg).toContain('Email is required');
});
```

### Dropdown & Select Interactions

```typescript
test('select dropdown options', async ({ page, formPopulator, dataProvider }) => {
  const testData = {
    country: 'USA',
    state: 'California',
    city: 'San Francisco'
  };
  
  const locators = {
    country: { locator: 'select#country', type: 'dropdown' },
    state: { locator: 'select#state', type: 'dropdown' },
    city: { locator: 'select#city', type: 'dropdown' }
  };
  
  await page.goto('/address-form');
  await formPopulator(page, locators, testData);
  
  // Verify selection
  const selectedCountry = await page.locator('#country').inputValue();
  expect(selectedCountry).toBe('USA');
});
```

### Checkbox & Radio Button Interactions

```typescript
test('select checkbox and radio options', async ({ page, formPopulator, dataProvider }) => {
  const testData = {
    terms: true,
    newsletter: true,
    gender: 'male',
    interests: ['sports', 'music']  // multiple checkboxes
  };
  
  const locators = {
    terms: { locator: 'input[type="checkbox"][name="terms"]', type: 'checkbox' },
    newsletter: { locator: 'input[type="checkbox"][name="newsletter"]', type: 'checkbox' },
    gender: { locator: 'input[type="radio"][name="gender"]', type: 'radio' },
    interests: { locator: 'input[type="checkbox"][name="interests"]', type: 'checkbox' }
  };
  
  await page.goto('/preferences');
  await formPopulator(page, locators, testData);
  
  // Verify selections
  const termsChecked = await page.locator('input[name="terms"]').isChecked();
  expect(termsChecked).toBe(true);
});
```

### File Upload

```typescript
test('upload file', async ({ page, formPopulator, dataProvider }) => {
  const testData = {
    fileUpload: './test-data/sample-document.pdf'
  };
  
  const locators = {
    fileUpload: { locator: 'input[type="file"][name="document"]', type: 'file' }
  };
  
  await page.goto('/upload-form');
  await formPopulator(page, locators, testData);
  await page.click('button[type="submit"]');
  
  await expect(page.locator('.upload-success')).toBeVisible();
});
```

### Wait for Dynamic Content

```typescript
test('wait for dynamically loaded content', async ({ page, actionBuilder }) => {
  await actionBuilder()
    .navigate('/dynamic-page')
    .click('#load-btn')
    .waitFor('.dynamic-content')  // Waits up to 5s by default
    .screenshot('after_dynamic_load')
    .execute();
  
  const content = await page.locator('.dynamic-content').textContent();
  expect(content).not.toBeEmpty();
});
```

### Network Interception & Mocking

```typescript
test('intercept and mock API response', async ({ page }) => {
  await page.route('**/api/users', async (route) => {
    await route.abort();  // Block the request
    // Or mock a response:
    // await route.fulfill({ status: 200, body: JSON.stringify([...]) });
  });
  
  await page.goto('/users-page');
  await expect(page.locator('.error-message')).toBeVisible();
});
```

### Handle Navigation & Pop-ups

```typescript
test('handle popup windows', async ({ context, page }) => {
  const popupPromise = context.waitForEvent('page');
  
  await page.goto('/page-with-popup');
  await page.click('a[target="_blank"]');
  
  const popup = await popupPromise;
  await expect(popup.locator('h1')).toContainText('Popup Page');
  await popup.close();
});
```

### Accessibility Testing

```typescript
test('page is accessible', async ({ page, axeRunner }) => {
  await page.goto('/');
  const axeResults = await axeRunner(page);
  
  expect(axeResults.violations).toEqual([]);
  expect(axeResults.passes.length).toBeGreaterThan(0);
});
```

## Page Object Pattern

Create reusable page objects for complex pages:

```typescript
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}
  
  async goto() {
    await this.page.goto('/login');
  }
  
  async login(email: string, password: string) {
    await this.page.fill('#email', email);
    await this.page.fill('#password', password);
    await this.page.click('button[type="submit"]');
  }
  
  async isLoggedIn() {
    return await this.page.locator('nav.dashboard').isVisible();
  }
}

// In test:
test('login flow', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password123');
  expect(await loginPage.isLoggedIn()).toBe(true);
});
```

## Best Practices

1. **Use FormPopulator for form fills** — avoids brittle multi-line fill sequences
2. **Keep locators in separate files** — easier to maintain when UI changes
3. **Use ActionBuilder for multi-step flows** — more readable than imperative code
4. **Store values in runtime store** — enables test chaining without duplication
5. **Leverage test data files** — no hardcoded values in test code
6. **Check artifacts on failure** — traces, screenshots, and logs auto-captured
7. **Use Page Object pattern** — abstracts page complexity from test logic
8. **Wait for elements explicitly** — use `.waitFor()` instead of `.sleep()`

## Related Skills

- **api-testing** — Patterns for OpenAPI-driven API contract tests
- **test-generation** — Auto-scaffold Web test suites from page specs
- **bdd-testing** — Gherkin-based Web scenario tests

## Quick Links

- **Framework Web Module:** `src/web/`
- **Sample Web Tests:** `tests/web/actionbuilder.spec.ts`, `tests/web/form-populator.spec.ts`
- **Test Data:** `test-data/`
- **Locators:** `test-data/locators-*.json`
