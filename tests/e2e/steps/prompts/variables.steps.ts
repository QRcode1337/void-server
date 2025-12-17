import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { VoidWorld } from '../../support/world';

Then('I should see variables grouped by category', async function (this: VoidWorld) {
  await expect(
    this.page.locator('.variable-category, [data-testid="category"], .category')
  ).toBeVisible();
});

When('I fill in the variable form', async function (this: VoidWorld) {
  await this.page.fill('input[name="id"], [data-testid="variable-id"]', 'e2e_test_var');
  await this.page.fill('input[name="name"], [data-testid="variable-name"]', 'E2E Test Variable');
  await this.page.fill('input[name="value"], textarea[name="value"]', 'test value');
});

When('I save the variable', async function (this: VoidWorld) {
  await this.page.click('button:has-text("Save")');
});

Then('I should see the new variable in the list', async function (this: VoidWorld) {
  await expect(this.page.locator('text=E2E Test Variable')).toBeVisible();
});
