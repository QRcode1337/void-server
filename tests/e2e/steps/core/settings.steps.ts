import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { VoidWorld } from '../../support/world';

When('I select the {string} theme', async function (this: VoidWorld, themeName: string) {
  await this.page.click(`text=${themeName}`);
});

When('I toggle the auto-collapse navigation setting', async function (this: VoidWorld) {
  const toggle = this.page.locator('text=Auto-collapse').locator('..').locator('input, button');
  await toggle.click();
});

Then('I should see a list of AI providers', async function (this: VoidWorld) {
  await expect(this.page.locator('text=LM Studio, text=Provider')).toBeVisible();
});
