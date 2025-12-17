import { Given, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { VoidWorld } from '../../support/world';

Given('an update is available', async function (this: VoidWorld) {
  // Skip if no update available - this is for testing the UI behavior
  const response = await this.request.get(`${this.config.appUrl}/api/version/check`);
  const data = await response.json();
  if (!data.hasUpdate) {
    this.skip();
  }
});

Given('I am running native installation', async function (this: VoidWorld) {
  if (this.parameters.environment === 'docker') {
    this.skip();
  }
});

Given('I am running in Docker', async function (this: VoidWorld) {
  if (this.parameters.environment !== 'docker') {
    this.skip();
  }
});

Then('I should see the update notification', async function (this: VoidWorld) {
  await expect(this.page.locator('text=Update')).toBeVisible();
});

Then('I should see Docker-specific update instructions', async function (this: VoidWorld) {
  await expect(this.page.locator('text=docker, text=Docker')).toBeVisible();
});
