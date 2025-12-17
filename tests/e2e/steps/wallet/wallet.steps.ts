import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { VoidWorld } from '../../support/world';

Given('the wallet plugin is enabled', async function (this: VoidWorld) {
  const response = await this.request.get(`${this.config.appUrl}/api/plugins`);
  const data = await response.json();
  const walletPlugin = data.installed?.find((p: {name: string}) => p.name === 'void-plugin-wallet');
  if (!walletPlugin || !walletPlugin.enabled) {
    this.skip();
  }
});

Then('I should see the wallet interface', async function (this: VoidWorld) {
  await expect(this.page.locator('.wallet, [data-testid="wallet"], main')).toBeVisible();
});

When('I click the create wallet button', async function (this: VoidWorld) {
  await this.page.click('button:has-text("Create"), button:has-text("Import")');
});

When('I enter a valid seed phrase', async function (this: VoidWorld) {
  const seedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  await this.page.fill('textarea, input[placeholder*="seed"]', seedPhrase);
});

When('I enter wallet name {string}', async function (this: VoidWorld, name: string) {
  await this.page.fill('input[name="name"], input[placeholder*="name"]', name);
});

When('I complete the wallet creation', async function (this: VoidWorld) {
  await this.page.click('button:has-text("Create"), button:has-text("Save")');
});

Then('a wallet should be created', async function (this: VoidWorld) {
  await expect(this.page.locator('text=Test Wallet')).toBeVisible({ timeout: 10000 });
});
