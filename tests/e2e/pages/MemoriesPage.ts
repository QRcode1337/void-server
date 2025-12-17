import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class MemoriesPage extends BasePage {
  readonly path = '/memories';

  constructor(page: Page, baseUrl: string) {
    super(page, baseUrl);
  }

  get memoryList(): Locator {
    return this.page.locator('[data-testid="memory-list"], .memory-list');
  }

  get newMemoryButton(): Locator {
    return this.page.locator('text=New Memory');
  }

  get searchInput(): Locator {
    return this.page.locator('input[placeholder*="Search"], [data-testid="memory-search"]');
  }

  get categoryFilter(): Locator {
    return this.page.locator('[data-testid="category-filter"], select');
  }

  get graphViewTab(): Locator {
    return this.page.locator('text=Graph');
  }

  get memoriesTab(): Locator {
    return this.page.locator('text=Memories').first();
  }

  get neo4jStatusBanner(): Locator {
    return this.page.locator('text=Neo4j');
  }

  async goto(tab?: string): Promise<void> {
    const path = tab ? `${this.path}/${tab}` : this.path;
    await super.goto(path);
  }

  async createMemory(content: string, category: string, importance: number): Promise<void> {
    await this.newMemoryButton.click();
    await this.page.fill('textarea[name="content"], [data-testid="memory-content"]', content);
    await this.page.selectOption(
      'select[name="category"], [data-testid="memory-category"]',
      category
    );
    await this.page.fill(
      'input[name="importance"], [data-testid="memory-importance"]',
      importance.toString()
    );
    await this.page.click('text=Save');
  }

  async searchMemories(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.waitForLoad();
  }

  async filterByCategory(category: string): Promise<void> {
    await this.categoryFilter.selectOption(category);
    await this.waitForLoad();
  }

  async goToGraphView(): Promise<void> {
    await this.graphViewTab.click();
  }

  async expectNeo4jConnected(): Promise<void> {
    await expect(this.page.locator('text=Connected')).toBeVisible();
  }

  async expectNeo4jDisconnected(): Promise<void> {
    await expect(this.page.locator('text=Disconnected, text=not connected')).toBeVisible();
  }

  async getMemoryCount(): Promise<number> {
    return this.memoryList.locator('[data-testid="memory-item"], .memory-item').count();
  }
}
