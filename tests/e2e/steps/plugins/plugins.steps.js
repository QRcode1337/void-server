const { Then, When } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Then('I should see installed plugins', async function () {
  await expect(this.page.locator('.plugin-list, [data-testid="plugins"]')).toBeVisible();
});

Then('I should see {string} in the list', async function (pluginName) {
  await expect(this.page.locator(`text=${pluginName}`)).toBeVisible();
});

Then('the {string} should have a {string} badge', async function (pluginName, badge) {
  const pluginCard = this.page.locator(`text=${pluginName}`).locator('..').locator('..');
  await expect(pluginCard.locator(`text=${badge}`)).toBeVisible();
});

When('I toggle the {string} plugin', async function (pluginName) {
  const pluginCard = this.page.locator(`text=${pluginName}`).locator('..').locator('..');
  const toggle = pluginCard.locator('input[type="checkbox"], button[role="switch"]');
  await toggle.click();
});

Then('I should see the restart required message', async function () {
  await expect(this.page.locator('text=Restart')).toBeVisible();
});
