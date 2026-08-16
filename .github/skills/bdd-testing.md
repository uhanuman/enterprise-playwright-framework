# Skill: BDD Testing Patterns

Comprehensive patterns for Behavior-Driven Development using Gherkin features and Playwright-BDD. Use this skill when:
- Writing Gherkin feature files for stakeholder collaboration
- Creating BDD step definitions that bridge QA and business teams
- Building reusable scenario templates with Examples tables
- Testing user journeys in business-readable language
- Integrating API and Web tests through BDD workflows

## How to Use This Skill

Ask Copilot: "**Use bdd-testing to create a Gherkin feature for the user login flow**"

Or for step definitions:
"**Use bdd-testing to implement step definitions for the registration feature**"

## Core Components

### 1. Gherkin Feature Files

Feature files describe test scenarios in business language:

```gherkin
# features/user-registration.feature

Feature: User Registration
  As a new user
  I want to register an account
  So that I can access the application

  Background:
    Given the registration page is loaded

  Scenario: Successful registration with valid data
    When I enter the following registration details:
      | Field   | Value               |
      | First   | John                |
      | Email   | john@example.com    |
      | Country | USA                 |
    And I accept the terms and conditions
    And I click the register button
    Then I should see a success message
    And a new account should be created with my email

  Scenario: Error on missing required field
    When I enter incomplete registration data:
      | Field | Value           |
      | First | John            |
    And I click the register button
    Then I should see an error message about missing fields

  Scenario Outline: Register with multiple data sets
    When I register with the following details:
      | firstName   | <firstName>   |
      | email       | <email>       |
      | country     | <country>     |
    Then the registration should <result>

    Examples:
      | firstName | email              | country | result   |
      | John      | john@example.com   | USA     | succeed  |
      | Jane      | jane@example.com   | UK      | succeed  |
      |           | invalid@example    | USA     | fail     |
      | Bob       | invalid-email      | USA     | fail     |
```

**Key elements:**
- **Feature:** High-level functionality description
- **Background:** Common setup for all scenarios in the feature
- **Scenario:** A single test case
- **Scenario Outline:** Parameterized test with Examples table
- **Given/When/Then:** Step definitions (see below)
- **And:** Continuation of previous step type
- **But:** Negation step
- **Examples:** Data table for parameterized tests

### 2. Step Definitions

Map Gherkin steps to code using fixtures:

```typescript
// tests/steps/registration.steps.ts

import { Given, When, Then } from 'playwright-bdd';
import { test, expect } from '../../src/framework/testBase';

// Use the test fixture to access framework components
Given('the registration page is loaded', async ({ page }) => {
  await page.goto('/register');
  await expect(page.locator('h1')).toContainText('Register');
});

When('I enter the following registration details:', async (
  { page, formPopulator, dataProvider },
  table
) => {
  // Convert table to test data format
  const testData = {};
  table.rowsHash().forEach((value, key) => {
    testData[key.toLowerCase()] = value;
  });
  
  const locators = await dataProvider.load('locators-signup');
  await formPopulator(page, locators, testData);
});

When('I enter incomplete registration data:', async (
  { page, formPopulator, dataProvider },
  table
) => {
  const testData = {};
  table.rowsHash().forEach((value, key) => {
    testData[key.toLowerCase()] = value;
  });
  
  const locators = await dataProvider.load('locators-signup');
  // Pass only the provided fields; others remain null
  await formPopulator(page, locators, testData);
});

When('I accept the terms and conditions', async ({ page }) => {
  await page.check('input[name="terms"]');
});

When('I click the register button', async ({ page }) => {
  await page.click('button[type="submit"]');
  // Wait for navigation or response
  await page.waitForURL('/confirm-email');
});

Then('I should see a success message', async ({ page }) => {
  const message = await page.locator('.success-msg').textContent();
  expect(message).toContain('Registration successful');
});

Then('a new account should be created with my email', async (
  { page, runtimeStore, dataProvider },
  table
) => {
  // Retrieve the email from runtime store (set by formPopulator)
  const email = await runtimeStore.get('registrationEmail');
  expect(email).toBeDefined();
});

Then('I should see an error message about missing fields', async ({ page }) => {
  const error = await page.locator('[role="alert"]').textContent();
  expect(error).toContain('required');
});

Then('the registration should {word}', async ({ page }, result) => {
  if (result === 'succeed') {
    await expect(page.locator('.success-msg')).toBeVisible();
  } else if (result === 'fail') {
    await expect(page.locator('[role="alert"]')).toBeVisible();
  }
});
```

### 3. Running BDD Tests

```bash
npm run test:bdd
```

This:
1. Generates step definitions from `.feature` files
2. Compiles TypeScript step files
3. Runs Playwright with BDD config
4. Generates HTML report in `output/reports/bdd/`

## Common BDD Patterns

### Login Feature

```gherkin
Feature: User Login
  As a registered user
  I want to log in
  So that I can access my account

  Background:
    Given there is a user account with email "user@example.com" and password "password123"
    And the login page is loaded

  Scenario: Successful login with valid credentials
    When I enter the email "user@example.com"
    And I enter the password "password123"
    And I click the login button
    Then I should be redirected to the dashboard
    And I should see my profile information

  Scenario: Error on incorrect password
    When I enter the email "user@example.com"
    And I enter the password "wrongpassword"
    And I click the login button
    Then I should see an error message "Invalid credentials"
    And I should remain on the login page

  Scenario Outline: Login with invalid email formats
    When I enter the email "<email>"
    And I enter the password "password123"
    And I click the login button
    Then the login should <result>

    Examples:
      | email          | result |
      | notanemail     | fail   |
      | user@          | fail   |
      | @example.com   | fail   |
      | user@example.com | succeed |
```

**Step definitions:**

```typescript
import { Given, When, Then } from 'playwright-bdd';

Given('there is a user account with email {string} and password {string}', 
  async ({ apiClient }, email, password) => {
    // Setup test user via API
    const spec = await specLoader.load('specs/openapi/sample.yaml');
    await apiClient.builder(spec, 'POST', '/users')
      .setBody({ email, password, name: 'Test User' })
      .execute();
  });

Given('the login page is loaded', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('h1')).toContainText('Login');
});

When('I enter the email {string}', async ({ page }, email) => {
  await page.fill('#email', email);
});

When('I enter the password {string}', async ({ page }, password) => {
  await page.fill('#password', password);
});

When('I click the login button', async ({ page }) => {
  await page.click('button[type="submit"]');
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  await page.waitForURL('/dashboard');
});

Then('I should see my profile information', async ({ page }) => {
  await expect(page.locator('[data-testid="profile-name"]')).toBeVisible();
});

Then('I should see an error message {string}', async ({ page }, message) => {
  const error = await page.locator('[role="alert"]').textContent();
  expect(error).toContain(message);
});

Then('I should remain on the login page', async ({ page }) => {
  expect(page.url()).toContain('/login');
});

Then('the login should {word}', async ({ page }, result) => {
  if (result === 'succeed') {
    await page.waitForURL('/dashboard');
  } else if (result === 'fail') {
    await expect(page.locator('[role="alert"]')).toBeVisible();
  }
});
```

### API Integration Feature

```gherkin
Feature: Create and Retrieve Users
  As a system administrator
  I want to create users via API
  So that they can access the application

  Scenario: Create a new user
    When I send a POST request to "/users" with:
      | name  | John Doe        |
      | email | john@example.com |
      | role  | admin           |
    Then the response status should be 201
    And the response should contain a user ID
    And the user should be stored in the database

  Scenario: Retrieve the created user
    When I retrieve the user with ID from the previous step
    Then the response status should be 200
    And the user details should match the creation request

  Scenario: API Error - Missing Required Field
    When I send a POST request to "/users" with:
      | name | John Doe |
    Then the response status should be 400
    And the error message should contain "email is required"
```

**Step definitions:**

```typescript
import { When, Then } from 'playwright-bdd';
import { specLoader } from '../../src/api';

When('I send a POST request to {string} with:', async (
  { apiClient, runtimeStore },
  endpoint,
  table
) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  
  const body = {};
  table.rowsHash().forEach((value, key) => {
    body[key] = value;
  });
  
  const response = await apiClient.builder(spec, 'POST', endpoint)
    .setBody(body)
    .execute();
  
  // Store response for assertions
  await runtimeStore.set('lastResponse', response);
  await runtimeStore.set('lastUserId', response.body.id);
});

When('I retrieve the user with ID from the previous step', async (
  { apiClient, runtimeStore },
  table
) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  const userId = await runtimeStore.get('lastUserId');
  
  const response = await apiClient.builder(spec, 'GET', '/users/{id}')
    .setPathParam('id', userId)
    .execute();
  
  await runtimeStore.set('lastResponse', response);
});

Then('the response status should be {int}', async ({ runtimeStore }, expectedStatus) => {
  const response = await runtimeStore.get('lastResponse');
  expect(response.status).toBe(expectedStatus);
});

Then('the response should contain a user ID', async ({ runtimeStore }) => {
  const response = await runtimeStore.get('lastResponse');
  expect(response.body).toHaveProperty('id');
});

Then('the user should be stored in the database', async ({ apiClient, runtimeStore }) => {
  const spec = await specLoader.load('specs/openapi/sample.yaml');
  const userId = await runtimeStore.get('lastUserId');
  
  const response = await apiClient.builder(spec, 'GET', '/users/{id}')
    .setPathParam('id', userId)
    .execute();
  
  expect(response.status).toBe(200);
});

Then('the user details should match the creation request', async (
  { runtimeStore },
  table
) => {
  const response = await runtimeStore.get('lastResponse');
  const expected = {};
  table.rowsHash().forEach((value, key) => {
    expected[key] = value;
  });
  
  Object.entries(expected).forEach(([key, value]) => {
    expect(response.body[key]).toBe(value);
  });
});

Then('the error message should contain {string}', async ({ runtimeStore }, substring) => {
  const response = await runtimeStore.get('lastResponse');
  const message = JSON.stringify(response.body);
  expect(message).toContain(substring);
});
```

### Multi-Step Workflow Feature

```gherkin
Feature: Complete User Journey
  As a new user
  I want to register, verify email, and create a profile
  So that I can fully access the platform

  Scenario: Complete onboarding flow
    Given the landing page is loaded
    When I click "Sign Up"
    And I enter registration details:
      | firstName | John             |
      | email     | john@example.com |
    And I click "Register"
    Then I should see a message "Check your email"
    
    When I verify my email using the confirmation code
    And I create a user profile:
      | bio              | Software Engineer |
      | preferredLanguage | JavaScript       |
    And I click "Complete"
    Then I should be logged in
    And I should see the dashboard
```

**Step definitions with runtime store:**

```typescript
import { Given, When, Then } from 'playwright-bdd';

Given('the landing page is loaded', async ({ page }) => {
  await page.goto('/');
});

When('I click {string}', async ({ page }, buttonText) => {
  await page.click(`button:has-text("${buttonText}")`);
});

When('I enter registration details:', async ({ page, formPopulator, runtimeStore }, table) => {
  const testData = {};
  table.rowsHash().forEach((value, key) => {
    testData[key.toLowerCase()] = value;
  });
  
  // Store email for later verification
  await runtimeStore.set('registrationEmail', testData.email);
  
  const locators = await dataProvider.load('locators-signup');
  await formPopulator(page, locators, testData);
});

When('I verify my email using the confirmation code', async (
  { page, runtimeStore, emailProvider }
) => {
  // Get email from runtime store
  const email = await runtimeStore.get('registrationEmail');
  
  // Retrieve confirmation code from email (requires email provider setup)
  const confirmationCode = await emailProvider.getLatestMessageCode(email);
  await runtimeStore.set('confirmationCode', confirmationCode);
  
  // Navigate to verification page and enter code
  await page.goto('/verify-email');
  await page.fill('#code', confirmationCode);
  await page.click('button[type="submit"]');
});

Then('I should see a message {string}', async ({ page }, messageText) => {
  await expect(page.locator(`text=${messageText}`)).toBeVisible();
});

Then('I should be logged in', async ({ page }) => {
  const authToken = await page.context().cookies();
  expect(authToken.some(c => c.name === 'auth_token')).toBe(true);
});
```

## Best Practices

1. **Write scenarios from user perspective** — use "I" and business language
2. **Keep steps reusable** — parameterize steps with regex captures (e.g., `{string}`, `{int}`)
3. **Use Background for common setup** — avoid repeating Given steps
4. **Leverage Examples tables** — enable data-driven testing in Gherkin
5. **Store IDs in runtime store** — chain multi-step scenarios without duplication
6. **Map Gherkin to framework fixtures** — access ActionBuilder, FormPopulator, apiClient directly
7. **Group related features** — organize by user journey or business capability
8. **Document step definitions** — include examples and acceptable parameter formats

## Step Definition Patterns

### String Parameter
```gherkin
When I enter the email "user@example.com"
```
```typescript
When('I enter the email {string}', async ({ page }, email) => { ... });
```

### Integer Parameter
```gherkin
Then I should see 5 items
```
```typescript
Then('I should see {int} items', async ({ page }, count) => { ... });
```

### Word (Single Identifier)
```gherkin
Then the login should succeed
```
```typescript
Then('the login should {word}', async ({ page }, result) => { ... });
```

### Data Table
```gherkin
When I enter the following data:
  | field  | value           |
  | name   | John            |
  | email  | john@example.com |
```
```typescript
When('I enter the following data:', async ({ page }, table) => {
  const data = table.rowsHash();
  // data = { name: 'John', email: 'john@example.com' }
});
```

## Hooks & Setup/Teardown

```typescript
import { Before, After } from 'playwright-bdd';

Before(async ({ page, runtimeStore }) => {
  // Setup before each scenario
  await runtimeStore.set('testStartTime', new Date().toISOString());
});

After(async ({ page, runtimeStore }) => {
  // Cleanup after each scenario
  const startTime = await runtimeStore.get('testStartTime');
  console.log(`Scenario duration: ${Date.now() - new Date(startTime).getTime()}ms`);
});
```

## Related Skills

- **test-generation** — Auto-scaffold BDD features from requirements
- **api-testing** — Patterns for API steps in BDD scenarios
- **web-testing** — Patterns for Web steps in BDD scenarios

## Quick Links

- **Framework BDD Config:** `playwright.bdd.config.ts`
- **Sample Features:** `features/`
- **Sample Steps:** `tests/steps/`
- **BDD Reports:** `output/reports/bdd/index.html`
