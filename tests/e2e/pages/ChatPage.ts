import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ChatPage extends BasePage {
  readonly path = '/chat';

  constructor(page: Page, baseUrl: string) {
    super(page, baseUrl);
  }

  get messageInput(): Locator {
    return this.page.locator(
      '[data-testid="chat-input"], textarea[placeholder*="message"], input[placeholder*="message"]'
    );
  }

  get sendButton(): Locator {
    return this.page.locator('[data-testid="send-button"], button[type="submit"]');
  }

  get messageList(): Locator {
    return this.page.locator('[data-testid="message-list"], .messages, .chat-messages');
  }

  get conversationList(): Locator {
    return this.page.locator('[data-testid="conversation-list"], .conversations, .chat-sidebar');
  }

  get newChatButton(): Locator {
    return this.page.locator('text=New Chat');
  }

  get thinkingIndicator(): Locator {
    return this.page.locator('text=Thinking');
  }

  async goto(chatId?: string): Promise<void> {
    const path = chatId ? `${this.path}/${chatId}` : this.path;
    await super.goto(path);
  }

  async sendMessage(text: string): Promise<void> {
    await this.messageInput.fill(text);
    await this.sendButton.click();
    await this.page.waitForSelector('[data-testid="assistant-message"], .assistant-message', {
      timeout: 30000,
    });
  }

  async getMessageCount(): Promise<number> {
    return this.messageList.locator('[data-testid="message"], .message').count();
  }

  async createNewChat(): Promise<void> {
    await this.newChatButton.click();
    await this.page.waitForURL(/\/chat\/[a-z0-9-]+/);
  }

  async expectNoProvidersWarning(): Promise<void> {
    await expect(this.page.locator('text=No AI Provider')).toBeVisible();
  }

  async expectProviderConfigured(): Promise<void> {
    await expect(this.messageInput).toBeVisible();
  }
}
