const { Given, When, Then, After } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

// Cleanup created browser profiles after scenarios
After(async function () {
  if (this.testData.createdProfileId) {
    await this.request.delete(`${this.config.appUrl}/api/browsers/${this.testData.createdProfileId}`);
    this.testData.createdProfileId = null;
  }
});

// Navigation - browser-specific route
Given('I am on the browsers page', async function () {
  await this.page.goto(`${this.config.appUrl}/browsers`, { timeout: 10000 });
  await this.page.waitForLoadState('load', { timeout: 10000 });
});

// Create profile form
When('I fill in the profile form:', async function (dataTable) {
  const data = dataTable.rowsHash();
  if (data.id) {
    await this.page.locator('input[placeholder="x-auth"]').fill(data.id);
  }
  if (data.name) {
    await this.page.locator('input[placeholder="X.com Authentication"]').fill(data.name);
  }
  if (data.description) {
    await this.page
      .locator('input[placeholder="Browser profile for authenticated sessions"]')
      .fill(data.description);
  }
  // Store for cleanup
  this.testData.createdProfileId = data.id;
});

// Browser-specific assertions
Then('I should see {string} in the browser list', async function (text) {
  // Use heading to match exact profile name, avoiding partial matches
  await expect(
    this.page.locator('.card').filter({ has: this.page.locator('h3', { hasText: text }) }).first()
  ).toBeVisible({ timeout: 5000 });
});

Then('I should not see {string} in the browser list', async function (text) {
  await expect(
    this.page.locator('.card').filter({ has: this.page.locator('h3', { hasText: text }) })
  ).not.toBeVisible({ timeout: 5000 });
});

// Profile management
Given('a browser profile {string} exists', async function (profileId) {
  // Create via API
  const response = await this.request.post(`${this.config.appUrl}/api/browsers`, {
    data: {
      id: profileId,
      name: `Test ${profileId}`,
      description: 'E2E test profile',
    },
  });
  const data = await response.json();
  if (!data.success && !data.error?.includes('already exists')) {
    throw new Error(`Failed to create profile: ${data.error}`);
  }
  // Reload page to see new profile
  await this.page.reload();
  await this.page.waitForLoadState('networkidle');
});

Given('a browser profile {string} exists via API', async function (profileId) {
  const response = await this.request.post(`${this.config.appUrl}/api/browsers`, {
    data: {
      id: profileId,
      name: `API Test ${profileId}`,
      description: 'Created via API for testing',
    },
  });
  const data = await response.json();
  if (!data.success && !data.error?.includes('already exists')) {
    throw new Error(`Failed to create profile: ${data.error}`);
  }
  this.testData.createdProfileId = profileId;
});

When('I delete the browser profile {string}', async function (profileId) {
  // Find the card with this profile and click delete
  const card = this.page.locator('.card').filter({ hasText: profileId });
  await card.getByRole('button', { name: /delete/i }).click();
});
