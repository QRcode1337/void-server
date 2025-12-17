const { Given, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Given('an update is available', async function () {
  const response = await this.request.get(`${this.config.appUrl}/api/version/check`);
  const data = await response.json();
  if (!data.hasUpdate) {
    return 'skipped';
  }
});

Given('I am running native installation', async function () {
  if (this.parameters.environment === 'docker') {
    return 'skipped';
  }
});

Given('I am running in Docker', async function () {
  if (this.parameters.environment !== 'docker') {
    return 'skipped';
  }
});

Then('I should see the update notification', async function () {
  await expect(this.page.locator('text=Update')).toBeVisible();
});

Then('I should see Docker-specific update instructions', async function () {
  await expect(this.page.locator('text=docker, text=Docker')).toBeVisible();
});
