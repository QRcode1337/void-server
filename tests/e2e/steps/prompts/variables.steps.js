const { Then, When } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Then('I should see variables grouped by category', async function () {
  await expect(
    this.page.locator('.variable-category, [data-testid="category"], .category')
  ).toBeVisible();
});

When('I fill in the variable form', async function () {
  await this.page.fill('input[name="id"], [data-testid="variable-id"]', 'e2e_test_var');
  await this.page.fill('input[name="name"], [data-testid="variable-name"]', 'E2E Test Variable');
  await this.page.fill('input[name="value"], textarea[name="value"]', 'test value');
});

When('I save the variable', async function () {
  await this.page.click('button:has-text("Save")');
});

Then('I should see the new variable in the list', async function () {
  await expect(this.page.locator('text=E2E Test Variable')).toBeVisible();
});
