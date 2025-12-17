const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

// Page navigation timeout - longer than default since it includes network requests
const NAV_TIMEOUT = 10000;

Given('I am on the dashboard page', async function () {
  await this.page.goto(`${this.config.appUrl}/`, { timeout: NAV_TIMEOUT });
  await this.page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT });
});

Given('I am on the {string} page', async function (pageName) {
  const routes = {
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
  await this.page.goto(`${this.config.appUrl}${route}`, { timeout: NAV_TIMEOUT });
  await this.page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT });
});

Given('I am on the settings page', async function () {
  await this.page.goto(`${this.config.appUrl}/settings`, { timeout: NAV_TIMEOUT });
  await this.page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT });
});

Given('I am on the templates page', async function () {
  await this.page.goto(`${this.config.appUrl}/prompts/templates`, { timeout: NAV_TIMEOUT });
  await this.page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT });
});

Given('I am on the variables page', async function () {
  await this.page.goto(`${this.config.appUrl}/prompts/variables`, { timeout: NAV_TIMEOUT });
  await this.page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT });
});

Given('I am on the chat page', async function () {
  await this.page.goto(`${this.config.appUrl}/chat`, { timeout: NAV_TIMEOUT });
  await this.page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT });
});

Given('I am on the memories page', async function () {
  await this.page.goto(`${this.config.appUrl}/memories`, { timeout: NAV_TIMEOUT });
  await this.page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT });
});

Given('I am on the plugin manager page', async function () {
  await this.page.goto(`${this.config.appUrl}/plugins`, { timeout: NAV_TIMEOUT });
  await this.page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT });
});

Given('I am on the wallet page', async function () {
  await this.page.goto(`${this.config.appUrl}/wallet`, { timeout: NAV_TIMEOUT });
  await this.page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT });
});

Given('I am on the IPFS page', async function () {
  await this.page.goto(`${this.config.appUrl}/ipfs`, { timeout: NAV_TIMEOUT });
  await this.page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT });
});

Given('I am on the {string} settings tab', async function (tabName) {
  await this.page.click(`button:has-text("${tabName}")`);
  await this.page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT });
});

When('I click the {string} button', async function (buttonText) {
  await this.page.click(`button:has-text("${buttonText}")`);
});

When('I click on the {string} tab', async function (tabName) {
  await this.page.click(`button:has-text("${tabName}")`);
  await this.page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT });
});

Then('I should see the {string} tab', async function (tabName) {
  // Use button role or first match to avoid multiple element issues
  await expect(
    this.page.locator(`button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`).first()
  ).toBeVisible();
});

Then('I should see the page heading', async function () {
  // Check for any visible heading in the main content area
  await expect(
    this.page.locator('main h1, main h2, [data-testid="page-heading"], .page-title').first()
  ).toBeVisible();
});

Then('I should see the {string} heading', async function (heading) {
  await expect(this.page.locator(`h1:has-text("${heading}"), h2:has-text("${heading}")`)).toBeVisible();
});

Then('I should see a success toast', async function () {
  await expect(
    this.page.locator('[class*="react-hot-toast"], [role="status"]')
  ).toBeVisible({ timeout: 5000 });
});

Then('I should see the {string} button', async function (buttonText) {
  await expect(
    this.page.getByRole('button', { name: buttonText })
  ).toBeVisible({ timeout: 5000 });
});
