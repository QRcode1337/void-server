import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { VoidWorld } from '../../support/world';

Then('the health check should return ok', async function (this: VoidWorld) {
  const response = await this.request.get(`${this.config.appUrl}/health`);
  const data = await response.json();
  expect(data.status).toBe('ok');
});

Then('I should see the {string} service indicator', async function (this: VoidWorld, service: string) {
  await expect(this.page.locator(`text=${service}`)).toBeVisible();
});

Then(
  'the {string} service should show {string} status',
  async function (this: VoidWorld, service: string, status: string) {
    const serviceCard = this.page.locator(`text=${service}`).locator('..').locator('..');
    await expect(serviceCard).toContainText(status, { ignoreCase: true });
  }
);
