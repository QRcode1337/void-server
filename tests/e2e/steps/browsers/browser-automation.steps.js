const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const DOWNLOAD_URL = 'https://raw.githubusercontent.com/ClawedCode/void-server/main/screenshot.png';

// Cleanup automation test profiles after scenarios
After({ tags: '@automation' }, async function () {
  if (this.testData.createdProfileId) {
    await this.request.delete(`${this.config.appUrl}/api/browsers/${this.testData.createdProfileId}`);
  }
  // Clean up downloaded files
  if (this.testData.downloadPath && fs.existsSync(this.testData.downloadPath)) {
    fs.unlinkSync(this.testData.downloadPath);
  }
});

When('I trigger a download using profile {string}', async function (profileId) {
  // This tests the server-side browser automation capability
  // In a real scenario, this would be called by a plugin

  // First, verify the profile exists
  const statusResponse = await this.request.get(`${this.config.appUrl}/api/browsers/${profileId}`);
  const statusData = await statusResponse.json();

  if (!statusData.success) {
    throw new Error(`Profile ${profileId} not found`);
  }

  // For e2e test, we simulate what a plugin would do:
  // Use the existing page to download a file
  // In production, plugins use browserService.getBrowserContext()

  const downloadDir = path.join(process.cwd(), 'data', 'downloads');
  fs.mkdirSync(downloadDir, { recursive: true });

  // Navigate to the file URL using existing page
  const response = await this.page.goto(DOWNLOAD_URL, { waitUntil: 'networkidle', timeout: 30000 });

  if (response.ok()) {
    // Save the response body as a file
    const buffer = await response.body();
    const filename = `test-download-${Date.now()}.png`;
    const filepath = path.join(downloadDir, filename);

    fs.writeFileSync(filepath, buffer);
    this.testData.downloadPath = filepath;
    this.testData.downloadSize = buffer.length;
  } else {
    throw new Error(`Failed to download: ${response.status()}`);
  }
});

Then('the download should complete successfully', async function () {
  expect(this.testData.downloadPath).toBeDefined();
  expect(this.testData.downloadSize).toBeGreaterThan(0);
});

Then('the downloaded file should exist', async function () {
  expect(fs.existsSync(this.testData.downloadPath)).toBe(true);
  const stats = fs.statSync(this.testData.downloadPath);
  expect(stats.size).toBeGreaterThan(0);
});

When('I navigate to {string} using profile {string}', async function (url, profileId) {
  // Verify profile exists
  const statusResponse = await this.request.get(`${this.config.appUrl}/api/browsers/${profileId}`);
  const statusData = await statusResponse.json();

  if (!statusData.success) {
    throw new Error(`Profile ${profileId} not found`);
  }

  // Navigate using the existing page
  await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  this.testData.pageTitle = await this.page.title();
});

Then('the page title should contain {string}', async function (expectedText) {
  expect(this.testData.pageTitle).toContain(expectedText);
});
