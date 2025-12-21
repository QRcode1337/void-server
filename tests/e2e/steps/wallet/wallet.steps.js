const { Given, When, Then, After, Before } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

// Clean up test wallets before and after wallet scenarios
Before({ tags: '@wallet-crud' }, async function () {
  // Delete any leftover test wallets from previous runs
  await cleanupTestWallets.call(this);
});

After({ tags: '@wallet-crud' }, async function () {
  // Clean up test wallets created during this scenario
  await cleanupTestWallets.call(this);
});

async function cleanupTestWallets() {
  // Get all wallet groups
  const response = await this.request.get(`${this.config.appUrl}/wallet/api/wallet/groups`);
  const data = await response.json();

  if (data.success && data.groups) {
    for (const group of data.groups) {
      // Delete test wallets (those with name containing "Test")
      if (group.name?.includes('Test') || group.name?.includes('E2E')) {
        for (const wallet of group.wallets || []) {
          await this.request.delete(`${this.config.appUrl}/wallet/api/wallet/${wallet.id}`);
        }
      }
    }
  }
}

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
