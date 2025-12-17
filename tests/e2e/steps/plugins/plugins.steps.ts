import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { VoidWorld } from '../../support/world';

Then('I should see installed plugins', async function (this: VoidWorld) {
  await expect(this.page.locator('.plugin-list, [data-testid="plugins"]')).toBeVisible();
});

Then('I should see {string} in the list', async function (this: VoidWorld, pluginName: string) {
  await expect(this.page.locator(`text=${pluginName}`)).toBeVisible();
});

Then('the {string} should have a {string} badge', async function (this: VoidWorld, pluginName: string, badge: string) {
  const pluginCard = this.page.locator(`text=${pluginName}`).locator('..').locator('..');
  await expect(pluginCard.locator(`text=${badge}`)).toBeVisible();
});

When('I toggle the {string} plugin', async function (this: VoidWorld, pluginName: string) {
  const pluginCard = this.page.locator(`text=${pluginName}`).locator('..').locator('..');
  const toggle = pluginCard.locator('input[type="checkbox"], button[role="switch"]');
  await toggle.click();
});

Then('I should see the restart required message', async function (this: VoidWorld) {
  await expect(this.page.locator('text=Restart')).toBeVisible();
});
