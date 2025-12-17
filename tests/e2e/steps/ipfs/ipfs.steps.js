const { Given, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Then('I should see the IPFS interface', async function () {
  await expect(this.page.locator('.ipfs, [data-testid="ipfs"], main')).toBeVisible();
});

Then('I should see the daemon status', async function () {
  await expect(this.page.locator('text=Online, text=Offline, text=Status')).toBeVisible();
});

Given('IPFS daemon is running', async function () {
  const response = await this.request.get(`${this.config.appUrl}/api/ipfs/status`);
  const status = await response.json();
  if (!status.online) {
    return 'skipped';
  }
});

Given('IPFS daemon is not running', async function () {
  const response = await this.request.get(`${this.config.appUrl}/api/ipfs/status`);
  const status = await response.json();
  if (status.online) {
    return 'skipped';
  }
});

Then('I should see {string} status', async function (status) {
  await expect(this.page.locator(`text=${status}`)).toBeVisible();
});
