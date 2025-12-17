const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Given('Neo4j is running and configured', async function () {
  const response = await this.request.get(`${this.config.appUrl}/api/memories/status`);
  const status = await response.json();
  if (!status.neo4j?.connected) {
    return 'skipped';
  }
});

Given('I have memories in the system', async function () {
  await this.request.post(`${this.config.appUrl}/api/memories`, {
    data: {
      content: { text: 'Test memory for e2e' },
      category: 'General',
      importance: 0.5,
    },
  });
});

Then('I should see the memory list or empty state', async function () {
  await expect(
    this.page.locator('.memory-list, [data-testid="memories"], text=No memories')
  ).toBeVisible();
});

When('I fill in the memory form', async function () {
  await this.page.fill('textarea[name="content"], [data-testid="memory-content"]', 'E2E Test Memory');
});

When('I save the memory', async function () {
  await this.page.click('button:has-text("Save")');
});

Then('the memory should appear in the list', async function () {
  await expect(this.page.locator('text=E2E Test Memory')).toBeVisible();
});

When('I search for {string}', async function (query) {
  await this.page.fill('input[placeholder*="Search"], [data-testid="search"]', query);
  await this.page.keyboard.press('Enter');
  await this.page.waitForLoadState('networkidle');
});

Then('I should see matching memories', async function () {
  await expect(this.page.locator('.memory-item, [data-testid="memory"]')).toBeVisible();
});

When('I click the {string} tab', async function (tabName) {
  await this.page.click(`text=${tabName}`);
});

Then('I should see the graph visualization', async function () {
  await expect(this.page.locator('canvas, [data-testid="graph"], .graph')).toBeVisible();
});
