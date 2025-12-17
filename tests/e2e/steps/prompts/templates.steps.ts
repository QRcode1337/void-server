import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { VoidWorld } from '../../support/world';

Then('I should see a list of templates', async function (this: VoidWorld) {
  await expect(this.page.locator('.template-list, [data-testid="templates"]')).toBeVisible();
});

When('I click on a template', async function (this: VoidWorld) {
  await this.page.click('.template-item, [data-testid="template"]');
});

Then('I should see the template editor', async function (this: VoidWorld) {
  await expect(
    this.page.locator('textarea, [data-testid="template-editor"], .editor')
  ).toBeVisible();
});

When('I fill in the template form', async function (this: VoidWorld) {
  await this.page.fill('input[name="name"], [data-testid="template-name"]', 'E2E Test Template');
  await this.page.fill('textarea[name="content"], [data-testid="template-content"]', 'Test content');
});

When('I save the template', async function (this: VoidWorld) {
  await this.page.click('button:has-text("Save")');
});

Then('I should see the new template in the list', async function (this: VoidWorld) {
  await expect(this.page.locator('text=E2E Test Template')).toBeVisible();
});
