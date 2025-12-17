const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Then('I should see a list of templates', async function () {
  await expect(this.page.locator('.template-list, [data-testid="templates"]')).toBeVisible();
});

When('I click on a template', async function () {
  await this.page.click('.template-item, [data-testid^="template-"]');
});

Then('I should see the template editor', async function () {
  // When a template is expanded, we see a preview in a <pre> tag, not an editable textarea
  // The textarea appears in the modal when clicking Edit
  await expect(
    this.page.locator('.template-item pre, [data-testid^="template-"] pre').first()
  ).toBeVisible({ timeout: 10000 });
});

When('I fill in the template form', async function () {
  // Generate unique name for this test run
  this.testData.templateName = `E2E Test Template ${Date.now()}`;
  await this.page.fill('input[name="name"], [data-testid="template-name"]', this.testData.templateName);
  await this.page.fill('textarea[name="content"], [data-testid="template-content"]', 'Test content');
});

When('I save the template', async function () {
  await this.page.click('button:has-text("Save")');
  // Wait for modal to close
  await this.page.waitForSelector('.fixed.inset-0', { state: 'hidden', timeout: 5000 });
});

Then('I should see the new template in the list', async function () {
  // Use the unique template name from this test run
  await expect(this.page.locator(`.template-item:has-text("${this.testData.templateName}")`).first()).toBeVisible({ timeout: 5000 });
});

When('I delete the test template', async function () {
  // Find the specific template item and click its delete button
  const templateItem = this.page.locator(`.template-item:has-text("${this.testData.templateName}")`).first();
  await templateItem.locator('button[title="Delete"]').click();
  // Wait for deletion to complete
  await this.page.waitForTimeout(500);
});

Then('the test template should be removed', async function () {
  // Verify the specific template is no longer visible
  await expect(this.page.locator(`.template-item:has-text("${this.testData.templateName}")`)).not.toBeVisible({ timeout: 5000 });
});
