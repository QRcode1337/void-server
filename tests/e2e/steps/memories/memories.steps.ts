import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { VoidWorld } from '../../support/world';

Given('Neo4j is running and configured', async function (this: VoidWorld) {
  const response = await this.request.get(`${this.config.appUrl}/api/memories/status`);
  const status = await response.json();
  if (!status.neo4j?.connected) {
    this.skip();
  }
});

Given('I have memories in the system', async function (this: VoidWorld) {
  await this.request.post(`${this.config.appUrl}/api/memories`, {
    data: {
      content: { text: 'Test memory for e2e' },
      category: 'General',
      importance: 0.5,
    },
  });
});

Then('I should see the memory list or empty state', async function (this: VoidWorld) {
  await expect(
    this.page.locator('.memory-list, [data-testid="memories"], text=No memories')
  ).toBeVisible();
});

When('I fill in the memory form', async function (this: VoidWorld) {
  await this.page.fill('textarea[name="content"], [data-testid="memory-content"]', 'E2E Test Memory');
});

When('I save the memory', async function (this: VoidWorld) {
  await this.page.click('button:has-text("Save")');
});

Then('the memory should appear in the list', async function (this: VoidWorld) {
  await expect(this.page.locator('text=E2E Test Memory')).toBeVisible();
});

When('I search for {string}', async function (this: VoidWorld, query: string) {
  await this.page.fill('input[placeholder*="Search"], [data-testid="search"]', query);
  await this.page.keyboard.press('Enter');
  await this.page.waitForLoadState('networkidle');
});

Then('I should see matching memories', async function (this: VoidWorld) {
  await expect(this.page.locator('.memory-item, [data-testid="memory"]')).toBeVisible();
});

When('I click the {string} tab', async function (this: VoidWorld, tabName: string) {
  await this.page.click(`text=${tabName}`);
});

Then('I should see the graph visualization', async function (this: VoidWorld) {
  await expect(this.page.locator('canvas, [data-testid="graph"], .graph')).toBeVisible();
});
