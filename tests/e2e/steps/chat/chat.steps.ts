import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { VoidWorld } from '../../support/world';

Then('I should see the chat interface', async function (this: VoidWorld) {
  await expect(
    this.page.locator('[data-testid="chat"], .chat-container, main')
  ).toBeVisible();
});

Then('I should see the chat sidebar', async function (this: VoidWorld) {
  await expect(
    this.page.locator('[data-testid="chat-sidebar"], .sidebar, nav')
  ).toBeVisible();
});

Given('at least one AI provider is enabled', async function (this: VoidWorld) {
  const response = await this.request.get(`${this.config.appUrl}/api/ai-providers`);
  const data = await response.json();
  if (!data.activeProvider) {
    this.skip();
  }
});

Given('I have an active chat', async function (this: VoidWorld) {
  const response = await this.request.post(`${this.config.appUrl}/api/chat`, {
    data: { templateId: 'clawedegregore' },
  });
  const chat = await response.json();
  this.testData.chatId = chat.id;
  await this.page.goto(`${this.config.appUrl}/chat/${chat.id}`);
  await this.page.waitForLoadState('networkidle');
});

When('a new chat should be created', async function (this: VoidWorld) {
  await this.page.waitForURL(/\/chat\/[a-z0-9-]+/);
});

When('I type {string} in the message input', async function (this: VoidWorld, message: string) {
  await this.page.fill('textarea, input[type="text"]', message);
});

When('I send the message', async function (this: VoidWorld) {
  await this.page.click('button[type="submit"], button:has-text("Send")');
});

Then('my message should appear in the chat', async function (this: VoidWorld) {
  await expect(this.page.locator('.user-message, [data-role="user"]')).toBeVisible();
});

Then('I should receive an AI response', async function (this: VoidWorld) {
  await expect(
    this.page.locator('.assistant-message, [data-role="assistant"]')
  ).toBeVisible({ timeout: 30000 });
});
