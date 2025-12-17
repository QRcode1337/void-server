const { Given, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Then('I should see the IPFS interface', async function () {
  await expect(this.page.locator('.ipfs, [data-testid="ipfs"], main')).toBeVisible();
});

Then('I should see the daemon status', async function () {
  // Look for IPFS status heading which shows "IPFS Online" or "IPFS Offline"
  await expect(this.page.locator('h3:has-text("IPFS Online"), h3:has-text("IPFS Offline")')).toBeVisible({ timeout: 5000 });
});

Given('IPFS daemon is running', async function () {
  const response = await this.request.get(`${this.config.appUrl}/api/ipfs/status`);
  const status = await response.json();
  if (!status.daemonOnline && !status.online) {
    return 'skipped';
  }
});

Given('IPFS daemon is not running', async function () {
  const response = await this.request.get(`${this.config.appUrl}/api/ipfs/status`);
  const status = await response.json();
  if (status.daemonOnline || status.online) {
    return 'skipped';
  }
});

Then('I should see {string} status', async function (status) {
  await expect(this.page.locator(`text=${status}`)).toBeVisible();
});
