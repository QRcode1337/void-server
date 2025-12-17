const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

When('I GET {string}', async function (endpoint) {
  const response = await this.request.get(`${this.config.appUrl}${endpoint}`);
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

When('I POST to {string} with a template', async function (endpoint) {
  const response = await this.request.post(`${this.config.appUrl}${endpoint}`, {
    data: { templateId: 'clawedegregore' },
  });
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

When('I POST to {string} with a seed phrase', async function (endpoint) {
  const response = await this.request.post(`${this.config.appUrl}${endpoint}`, {
    data: {
      seedPhrase: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      count: 5,
    },
  });
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

When('I try to DELETE {string}', async function (endpoint) {
  const response = await this.request.delete(`${this.config.appUrl}${endpoint}`);
  this.testData.lastResponse = await response.json().catch(() => ({}));
  this.testData.lastStatus = response.status();
});

When('I request the health endpoint', async function () {
  const response = await this.request.get(`${this.config.appUrl}/health`);
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

When('I request the version endpoint', async function () {
  const response = await this.request.get(`${this.config.appUrl}/api/version`);
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

Then('the response should be successful', async function () {
  expect(this.testData.lastStatus).toBeLessThan(400);
});

Then('the response status should be {string}', async function (status) {
  const response = this.testData.lastResponse;
  expect(response.status).toBe(status);
});

Then('the response should contain a version number', async function () {
  const response = this.testData.lastResponse;
  expect(response.version).toBeDefined();
  expect(typeof response.version).toBe('string');
});

Then('the response should contain the version', async function () {
  const response = this.testData.lastResponse;
  expect(response.version).toBeDefined();
});

Then('the response should contain providers', async function () {
  const response = this.testData.lastResponse;
  expect(response.providers || response.activeProvider).toBeDefined();
});

Then('the response should contain templates', async function () {
  const response = this.testData.lastResponse;
  expect(Array.isArray(response) || response.templates).toBeTruthy();
});

Then('the response should contain core template IDs', async function () {
  const response = this.testData.lastResponse;
  expect(Array.isArray(response)).toBeTruthy();
});

Then('the response should contain variables', async function () {
  const response = this.testData.lastResponse;
  expect(Array.isArray(response) || response.variables).toBeTruthy();
});

Then('the response should contain memories', async function () {
  const response = this.testData.lastResponse;
  expect(response.memories || Array.isArray(response)).toBeTruthy();
});

Then('the response should contain statistics', async function () {
  const response = this.testData.lastResponse;
  expect(response.stats || response.byCategory || Array.isArray(response)).toBeTruthy();
});

Then('the response should contain installed plugins', async function () {
  const response = this.testData.lastResponse;
  expect(response.installed || response.plugins).toBeDefined();
});

Then('the response should contain available plugins', async function () {
  const response = this.testData.lastResponse;
  expect(response.available !== undefined || response.manifest !== undefined).toBeTruthy();
});

Then('the response should contain a chat id', async function () {
  const response = this.testData.lastResponse;
  expect(response.id || response.chat?.id).toBeDefined();
});

Then('the response should contain derived addresses', async function () {
  const response = this.testData.lastResponse;
  expect(response.addresses || Array.isArray(response)).toBeTruthy();
});

Then('the response should contain daemon status', async function () {
  const response = this.testData.lastResponse;
  expect(response.online !== undefined || response.status !== undefined).toBeTruthy();
});

Then('the response should contain update information', async function () {
  const response = this.testData.lastResponse;
  expect(response.hasUpdate !== undefined || response.currentVersion !== undefined).toBeTruthy();
});

Then('the response should indicate failure', async function () {
  expect(this.testData.lastStatus).toBeGreaterThanOrEqual(400);
});
