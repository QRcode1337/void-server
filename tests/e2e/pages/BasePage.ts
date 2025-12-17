import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  protected page: Page;
  protected baseUrl: string;

  constructor(page: Page, baseUrl: string) {
    this.page = page;
    this.baseUrl = baseUrl;
  }

  get navigation(): Locator {
    return this.page.locator('[data-testid="navigation"], nav, .sidebar');
  }

  get pageTitle(): Locator {
    return this.page.locator('h1').first();
  }

  async goto(path = ''): Promise<void> {
    await this.page.goto(`${this.baseUrl}${path}`);
    await this.waitForLoad();
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async clickNavItem(text: string): Promise<void> {
    await this.navigation.locator(`text=${text}`).click();
    await this.waitForLoad();
  }

  async expectToastMessage(message: string, timeout = 5000): Promise<void> {
    const toast = this.page.locator('[class*="react-hot-toast"], [role="status"]', {
      hasText: message,
    });
    await expect(toast).toBeVisible({ timeout });
  }

  async getApiResponse<T>(endpoint: string): Promise<T> {
    const response = await this.page.request.get(`${this.baseUrl}${endpoint}`);
    return response.json();
  }

  async clickButton(text: string): Promise<void> {
    await this.page.click(`button:has-text("${text}")`);
  }

  async fillInput(selector: string, value: string): Promise<void> {
    await this.page.fill(selector, value);
  }

  async expectVisible(selector: string, timeout = 5000): Promise<void> {
    await expect(this.page.locator(selector)).toBeVisible({ timeout });
  }

  async expectText(selector: string, text: string): Promise<void> {
    await expect(this.page.locator(selector)).toContainText(text);
  }
}
