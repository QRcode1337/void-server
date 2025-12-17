const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

When('I select the {string} theme', async function (themeName) {
  await this.page.click(`text=${themeName}`);
});

When('I toggle the auto-collapse navigation setting', async function () {
  const toggle = this.page.locator('text=Auto-collapse').locator('..').locator('input, button');
  await toggle.click();
});

Then('I should see a list of AI providers', async function () {
  await expect(this.page.locator('text=LM Studio, text=Provider')).toBeVisible();
});
