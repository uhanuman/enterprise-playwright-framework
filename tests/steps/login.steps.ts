import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../../src/framework/testBase.js';

const { Given, When, Then } = createBdd(test);

const LOGIN_PAGE = `
  <form onsubmit="event.preventDefault(); return false;">
    <input id="email" placeholder="email" />
    <input id="password" type="password" placeholder="password" />
    <button id="submit">Sign in</button>
    <div class="login-error" hidden>Invalid credentials</div>
  </form>
`;

Given('I am on the login page', async ({ page }) => {
  await page.setContent(LOGIN_PAGE);
});

When('I login with valid credentials', async ({ page, actionBuilder, dataProvider }) => {
  const data = await dataProvider.load('user-login');
  await actionBuilder()
    .fill('#email', data.email as string)
    .fill('#password', data.password as string)
    .click('#submit')
    .execute();
  await page.evaluate(() => {
    const dash = document.createElement('div');
    dash.className = 'dashboard';
    dash.textContent = 'Welcome';
    document.body.appendChild(dash);
  });
});

When('I login with invalid credentials', async ({ page, actionBuilder }) => {
  await actionBuilder()
    .fill('#email', 'invalid@example.com')
    .fill('#password', 'wrong-password')
    .click('#submit')
    .execute();
  await page.locator('.login-error').evaluate((el) => {
    (el as HTMLElement).hidden = false;
  });
});

Then('I should see the dashboard', async ({ page }) => {
  await expect(page.locator('.dashboard')).toBeVisible();
});

Then('I should see an error message', async ({ page }) => {
  await expect(page.locator('.login-error')).toBeVisible();
});