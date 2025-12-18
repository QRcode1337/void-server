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
  // Check for either memories list or empty state message
  const memoryList = this.page.locator('.memory-list, [data-testid="memories"], main').first();
  const emptyState = this.page.locator('text=No memories');

  const listVisible = await memoryList.isVisible().catch(() => false);
  const emptyVisible = await emptyState.isVisible().catch(() => false);

  expect(listVisible || emptyVisible).toBe(true);
});

When('I fill in the memory form', async function () {
  // Generate unique ID for this test run
  this.testData.memoryContent = `E2E Test Memory ${Date.now()}`;
  await this.page.fill('textarea[name="content"], [data-testid="memory-content"]', this.testData.memoryContent);
});

When('I save the memory', async function () {
  await this.page.click('button:has-text("Save")');
  // Wait for modal to close and memory list to update
  await this.page.waitForSelector('.fixed.inset-0', { state: 'hidden', timeout: 5000 });
});

Then('the memory should appear in the list', async function () {
  // Use the unique memory content from this test run
  await expect(this.page.locator(`.memory-item:has-text("${this.testData.memoryContent}")`).first()).toBeVisible({ timeout: 5000 });
});

When('I search for {string}', async function (query) {
  await this.page.fill('input[placeholder*="Search"], [data-testid="search"]', query);
  await this.page.keyboard.press('Enter');
  await this.page.waitForLoadState('networkidle');
});

Then('I should see matching memories', async function () {
  await expect(this.page.locator('.memory-item, [data-testid^="memory-"]').first()).toBeVisible();
});

When('I click the {string} tab', async function (tabName) {
  await this.page.click(`text=${tabName}`);
});

Then('I should see the graph visualization', async function () {
  // Wait for the graph container to be visible (may take time to load and render)
  await expect(this.page.locator('[data-testid="graph"]').first()).toBeVisible({ timeout: 15000 });
});

When('I delete the test memory', async function () {
  // Find the specific memory item from this test run and click its delete button
  const memoryItem = this.page.locator(`.memory-item:has-text("${this.testData.memoryContent}")`).first();
  await memoryItem.locator('button[title="Delete"]').click();

  // Wait for confirmation modal and confirm deletion
  await expect(this.page.locator('[data-testid="delete-confirm-modal"]')).toBeVisible({ timeout: 5000 });
  await this.page.click('[data-testid="confirm-delete"]');
});

Then('the test memory should be removed', async function () {
  // Verify the specific memory is no longer visible (optimistic update - should be immediate)
  await expect(this.page.locator(`.memory-item:has-text("${this.testData.memoryContent}")`)).not.toBeVisible({ timeout: 5000 });
});
