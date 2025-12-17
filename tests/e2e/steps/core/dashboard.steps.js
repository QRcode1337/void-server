const { Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Then('the health check should return ok', async function () {
  const response = await this.request.get(`${this.config.appUrl}/health`);
  const data = await response.json();
  expect(data.status).toBe('ok');
});

Then('I should see the {string} service indicator', async function (service) {
  await expect(this.page.locator(`text=${service}`)).toBeVisible();
});

Then(
  'the {string} service should show {string} status',
  async function (service, status) {
    const serviceCard = this.page.locator(`text=${service}`).locator('..').locator('..');
    await expect(serviceCard).toContainText(status, { ignoreCase: true });
  }
);
