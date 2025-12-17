const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Given('the wallet plugin is enabled', async function () {
  const response = await this.request.get(`${this.config.appUrl}/api/plugins`);
  const data = await response.json();
  const walletPlugin = data.installed?.find((p) => p.name === 'void-plugin-wallet');
  if (!walletPlugin || !walletPlugin.enabled) {
    return 'skipped';
  }
});

Then('I should see the wallet interface', async function () {
  await expect(this.page.locator('.wallet, [data-testid="wallet"], main')).toBeVisible();
});

When('I click the create wallet button', async function () {
  await this.page.click('button:has-text("Create"), button:has-text("Import")');
});

When('I enter a valid seed phrase', async function () {
  const seedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  await this.page.fill('textarea, input[placeholder*="seed"]', seedPhrase);
});

When('I enter wallet name {string}', async function (name) {
  await this.page.fill('input[name="name"], input[placeholder*="name"]', name);
});

When('I complete the wallet creation', async function () {
  // Target the button inside the modal (last match since modal overlays the page)
  // Use force:true if modal backdrop intercepts clicks
  const button = this.page.locator('button:has-text("Create"), button:has-text("Import"), button:has-text("Save")').last();
  await button.click({ timeout: 5000 });
});

Then('a wallet should be created', async function () {
  await expect(this.page.locator('text=Test Wallet').first()).toBeVisible({ timeout: 10000 });
});
