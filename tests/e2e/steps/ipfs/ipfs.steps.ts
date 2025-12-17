import { Given, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { VoidWorld } from '../../support/world';

Then('I should see the IPFS interface', async function (this: VoidWorld) {
  await expect(this.page.locator('.ipfs, [data-testid="ipfs"], main')).toBeVisible();
});

Then('I should see the daemon status', async function (this: VoidWorld) {
  await expect(this.page.locator('text=Online, text=Offline, text=Status')).toBeVisible();
});

Given('IPFS daemon is running', async function (this: VoidWorld) {
  const response = await this.request.get(`${this.config.appUrl}/api/ipfs/status`);
  const status = await response.json();
  if (!status.online) {
    this.skip();
  }
});

Given('IPFS daemon is not running', async function (this: VoidWorld) {
  const response = await this.request.get(`${this.config.appUrl}/api/ipfs/status`);
  const status = await response.json();
  if (status.online) {
    this.skip();
  }
});

Then('I should see {string} status', async function (this: VoidWorld, status: string) {
  await expect(this.page.locator(`text=${status}`)).toBeVisible();
});
