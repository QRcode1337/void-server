const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Then('I should see the chat interface', async function () {
  await expect(
    this.page.locator('[data-testid="chat"], .chat-container, main')
  ).toBeVisible();
});

Then('I should see the chat sidebar', async function () {
  await expect(
    this.page.locator('[data-testid="chat-sidebar"], .sidebar, nav')
  ).toBeVisible();
});

Given('at least one AI provider is enabled', async function () {
  const response = await this.request.get(`${this.config.appUrl}/api/ai-providers`);
  const data = await response.json();
  if (!data.activeProvider) {
    return 'skipped';
  }
});

Given('I have an active chat', async function () {
  const response = await this.request.post(`${this.config.appUrl}/api/chat`, {
    data: { templateId: 'clawedegregore' },
  });
  const data = await response.json();
  const chat = data.chat || data;
  this.testData.chatId = chat.id;
  await this.page.goto(`${this.config.appUrl}/chat/${chat.id}`, { timeout: 10000 });
  await this.page.waitForLoadState('networkidle', { timeout: 10000 });
  // Wait for chat interface to be ready
  await this.page.locator('[data-testid="message-input"], textarea').waitFor({ state: 'visible', timeout: 10000 });
});

When('a new chat should be created', async function () {
  await this.page.waitForURL(/\/chat\/[a-z0-9-]+/);
});

When('I type {string} in the message input', async function (message) {
  const input = this.page.locator('[data-testid="message-input"], textarea');
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(message);
});

When('I send the message', async function () {
  await this.page.click('[data-testid="send-button"], button:has-text("Send")');
});

Then('my message should appear in the chat', async function () {
  await expect(this.page.locator('.user-message, [data-role="user"]')).toBeVisible();
});

Then('I should receive an AI response', async function () {
  // LM Studio responses can be slow depending on model and hardware
  await expect(
    this.page.locator('[data-role="assistant"]')
  ).toBeVisible({ timeout: 60000 });
});
