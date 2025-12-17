import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { VoidWorld } from '../../support/world';

Given('I am on the dashboard page', async function (this: VoidWorld) {
  await this.page.goto(`${this.config.appUrl}/`);
  await this.page.waitForLoadState('networkidle');
});

Given('I am on the {string} page', async function (this: VoidWorld, pageName: string) {
  const routes: Record<string, string> = {
    dashboard: '/',
    chat: '/chat',
    memories: '/memories',
    plugins: '/plugins',
    'plugin manager': '/plugins',
    settings: '/settings',
    templates: '/prompts/templates',
    variables: '/prompts/variables',
    browsers: '/browsers',
    ipfs: '/ipfs',
    logs: '/logs',
    wallet: '/wallet',
  };

  const route = routes[pageName.toLowerCase()];
  if (!route) {
    throw new Error(`Unknown page: ${pageName}`);
  }
  await this.page.goto(`${this.config.appUrl}${route}`);
  await this.page.waitForLoadState('networkidle');
});

Given('I am on the settings page', async function (this: VoidWorld) {
  await this.page.goto(`${this.config.appUrl}/settings`);
  await this.page.waitForLoadState('networkidle');
});

Given('I am on the templates page', async function (this: VoidWorld) {
  await this.page.goto(`${this.config.appUrl}/prompts/templates`);
  await this.page.waitForLoadState('networkidle');
});

Given('I am on the variables page', async function (this: VoidWorld) {
  await this.page.goto(`${this.config.appUrl}/prompts/variables`);
  await this.page.waitForLoadState('networkidle');
});

Given('I am on the chat page', async function (this: VoidWorld) {
  await this.page.goto(`${this.config.appUrl}/chat`);
  await this.page.waitForLoadState('networkidle');
});

Given('I am on the memories page', async function (this: VoidWorld) {
  await this.page.goto(`${this.config.appUrl}/memories`);
  await this.page.waitForLoadState('networkidle');
});

Given('I am on the plugin manager page', async function (this: VoidWorld) {
  await this.page.goto(`${this.config.appUrl}/plugins`);
  await this.page.waitForLoadState('networkidle');
});

Given('I am on the wallet page', async function (this: VoidWorld) {
  await this.page.goto(`${this.config.appUrl}/wallet`);
  await this.page.waitForLoadState('networkidle');
});

Given('I am on the IPFS page', async function (this: VoidWorld) {
  await this.page.goto(`${this.config.appUrl}/ipfs`);
  await this.page.waitForLoadState('networkidle');
});

Given('I am on the {string} settings tab', async function (this: VoidWorld, tabName: string) {
  await this.page.click(`text=${tabName}`);
  await this.page.waitForLoadState('networkidle');
});

When('I click the {string} button', async function (this: VoidWorld, buttonText: string) {
  await this.page.click(`button:has-text("${buttonText}")`);
});

When('I click on the {string} tab', async function (this: VoidWorld, tabName: string) {
  await this.page.click(`text=${tabName}`);
  await this.page.waitForLoadState('networkidle');
});

Then('I should see the {string} tab', async function (this: VoidWorld, tabName: string) {
  await expect(this.page.locator(`text=${tabName}`)).toBeVisible();
});

Then('I should see the page heading', async function (this: VoidWorld) {
  await expect(this.page.locator('h1').first()).toBeVisible();
});

Then('I should see the {string} heading', async function (this: VoidWorld, heading: string) {
  await expect(this.page.locator(`h1:has-text("${heading}"), h2:has-text("${heading}")`)).toBeVisible();
});

Then('I should see a success toast', async function (this: VoidWorld) {
  await expect(
    this.page.locator('[class*="react-hot-toast"], [role="status"]')
  ).toBeVisible({ timeout: 5000 });
});
