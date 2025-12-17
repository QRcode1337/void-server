const { Then, When } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Then('I should see variables grouped by category', async function () {
  await expect(
    this.page.locator('.variable-category, [data-testid^="category-"], .category').first()
  ).toBeVisible();
});

When('I fill in the variable form', async function () {
  // Generate unique ID for this test run
  const timestamp = Date.now();
  this.testData.variableId = `e2e_test_var_${timestamp}`;
  this.testData.variableName = `E2E Test Variable ${timestamp}`;
  await this.page.fill('input[name="id"], [data-testid="variable-id"]', this.testData.variableId);
  await this.page.fill('input[name="name"], [data-testid="variable-name"]', this.testData.variableName);
  await this.page.fill('input[name="value"], textarea[name="value"]', 'test value');
});

When('I save the variable', async function () {
  await this.page.click('button:has-text("Save")');
  // Wait for modal to close
  await this.page.waitForSelector('.fixed.inset-0', { state: 'hidden', timeout: 5000 });
});

Then('I should see the new variable in the list', async function () {
  // Use the unique variable name from this test run
  await expect(this.page.locator(`.card:has-text("${this.testData.variableName}")`).first()).toBeVisible({ timeout: 5000 });
});

When('I delete the test variable', async function () {
  // Find the specific variable card and click its delete button
  const variableCard = this.page.locator(`.card:has-text("${this.testData.variableName}")`).first();
  await variableCard.locator('button[title="Delete"]').click();
  // Wait for deletion to complete
  await this.page.waitForTimeout(500);
});

Then('the test variable should be removed', async function () {
  // Verify the specific variable is no longer visible
  await expect(this.page.locator(`.card:has-text("${this.testData.variableName}")`)).not.toBeVisible({ timeout: 5000 });
});
