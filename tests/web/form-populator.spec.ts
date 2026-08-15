import { test, expect } from '../../src/framework/testBase.js';

test('formPopulator fills a page from locator + test-data assets', async ({ page, formPopulator, dataProvider, frameworkLogger }) => {
  await page.setContent(`
    <form onsubmit="event.preventDefault(); return false;">
      <input id="firstName" />
      <input id="lastName" />
      <input id="email" />
      <input id="age" />
      <input type="radio" name="gender" value="male" id="gender" />
      <select id="country"><option value="India">India</option></select>
      <input type="checkbox" id="terms" />
      <button id="submit">Submit</button>
      <div id="success" class="success"></div>
    </form>
  `);

  const locators = await dataProvider.loadLocators('locators-signup');
  const testData = await dataProvider.load('test-data-signup');

  const result = await formPopulator(page, locators, testData, { onFieldError: 'warn' });

  expect(result.populated).toContain('firstName');
  expect(result.populated).toContain('country');
  expect(await page.locator('#firstName').inputValue()).toBe('John');
  expect(await page.locator('#lastName').inputValue()).toBe('Doe');
  expect(await page.locator('#email').inputValue()).toBe('JohnDoe@mailinator.com');
  expect(await page.locator('#country').inputValue()).toBe('India');

  frameworkLogger.info('form populated', { populated: result.populated });
  await expect(page.locator('#submit')).toBeEnabled();
});

test('formPopulator auto-resolves Form.io IDs when no locator given', async ({ page, formPopulator }) => {
  await page.setContent(`
    <form>
      <input id="firstName" />
      <input id="email" />
      <button id="submit">Submit</button>
    </form>
  `);

  const result = await formPopulator(
    page,
    {
      firstName: { type: 'textbox' },
      email: { type: 'textbox' }
    },
    { firstName: 'Ada', email: 'ada@example.com' },
    { formIoIds: true }
  );

  expect(result.populated).toEqual(['firstName', 'email']);
  expect(await page.locator('#firstName').inputValue()).toBe('Ada');
});

test('formPopulator skips empty fields when skipEmpty is true', async ({ page, formPopulator }) => {
  await page.setContent('<form><input id="name" /></form>');

  const result = await formPopulator(
    page,
    { name: { type: 'textbox' } },
    { name: '' },
    { skipEmpty: true }
  );

  expect(result.skipped).toContain('name');
  expect(result.populated).not.toContain('name');
});