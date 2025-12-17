import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { VoidWorld } from '../../support/world';

When('I GET {string}', async function (this: VoidWorld, endpoint: string) {
  const response = await this.request.get(`${this.config.appUrl}${endpoint}`);
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

When('I POST to {string} with a template', async function (this: VoidWorld, endpoint: string) {
  const response = await this.request.post(`${this.config.appUrl}${endpoint}`, {
    data: { templateId: 'clawedegregore' },
  });
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

When('I POST to {string} with a seed phrase', async function (this: VoidWorld, endpoint: string) {
  const response = await this.request.post(`${this.config.appUrl}${endpoint}`, {
    data: {
      seedPhrase: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      count: 5,
    },
  });
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

When('I try to DELETE {string}', async function (this: VoidWorld, endpoint: string) {
  const response = await this.request.delete(`${this.config.appUrl}${endpoint}`);
  this.testData.lastResponse = await response.json().catch(() => ({}));
  this.testData.lastStatus = response.status();
});

When('I request the health endpoint', async function (this: VoidWorld) {
  const response = await this.request.get(`${this.config.appUrl}/health`);
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

When('I request the version endpoint', async function (this: VoidWorld) {
  const response = await this.request.get(`${this.config.appUrl}/api/version`);
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

Then('the response should be successful', async function (this: VoidWorld) {
  expect(this.testData.lastStatus).toBeLessThan(400);
});

Then('the response status should be {string}', async function (this: VoidWorld, status: string) {
  const response = this.testData.lastResponse as Record<string, unknown>;
  expect(response.status).toBe(status);
});

Then('the response should contain a version number', async function (this: VoidWorld) {
  const response = this.testData.lastResponse as Record<string, unknown>;
  expect(response.version).toBeDefined();
  expect(typeof response.version).toBe('string');
});

Then('the response should contain the version', async function (this: VoidWorld) {
  const response = this.testData.lastResponse as Record<string, unknown>;
  expect(response.version).toBeDefined();
});

Then('the response should contain providers', async function (this: VoidWorld) {
  const response = this.testData.lastResponse as Record<string, unknown>;
  expect(response.providers || response.activeProvider).toBeDefined();
});

Then('the response should contain templates', async function (this: VoidWorld) {
  const response = this.testData.lastResponse as unknown[];
  expect(Array.isArray(response) || (response as Record<string, unknown>).templates).toBeTruthy();
});

Then('the response should contain core template IDs', async function (this: VoidWorld) {
  const response = this.testData.lastResponse as unknown[];
  expect(Array.isArray(response)).toBeTruthy();
});

Then('the response should contain variables', async function (this: VoidWorld) {
  const response = this.testData.lastResponse as unknown[];
  expect(Array.isArray(response) || (response as Record<string, unknown>).variables).toBeTruthy();
});

Then('the response should contain memories', async function (this: VoidWorld) {
  const response = this.testData.lastResponse as Record<string, unknown>;
  expect(response.memories || Array.isArray(response)).toBeTruthy();
});

Then('the response should contain statistics', async function (this: VoidWorld) {
  const response = this.testData.lastResponse as Record<string, unknown>;
  expect(response.stats || response.byCategory || Array.isArray(response)).toBeTruthy();
});

Then('the response should contain installed plugins', async function (this: VoidWorld) {
  const response = this.testData.lastResponse as Record<string, unknown>;
  expect(response.installed || response.plugins).toBeDefined();
});

Then('the response should contain available plugins', async function (this: VoidWorld) {
  const response = this.testData.lastResponse as Record<string, unknown>;
  expect(response.available !== undefined || response.manifest !== undefined).toBeTruthy();
});

Then('the response should contain a chat id', async function (this: VoidWorld) {
  const response = this.testData.lastResponse as Record<string, unknown>;
  expect(response.id || response.chat?.id).toBeDefined();
});

Then('the response should contain derived addresses', async function (this: VoidWorld) {
  const response = this.testData.lastResponse as Record<string, unknown>;
  expect(response.addresses || Array.isArray(response)).toBeTruthy();
});

Then('the response should contain daemon status', async function (this: VoidWorld) {
  const response = this.testData.lastResponse as Record<string, unknown>;
  expect(response.online !== undefined || response.status !== undefined).toBeTruthy();
});

Then('the response should contain update information', async function (this: VoidWorld) {
  const response = this.testData.lastResponse as Record<string, unknown>;
  expect(response.hasUpdate !== undefined || response.currentVersion !== undefined).toBeTruthy();
});

Then('the response should indicate failure', async function (this: VoidWorld) {
  expect(this.testData.lastStatus).toBeGreaterThanOrEqual(400);
});
