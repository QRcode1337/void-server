import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  readonly path = '/';

  constructor(page: Page, baseUrl: string) {
    super(page, baseUrl);
  }

  get versionDisplay(): Locator {
    return this.page.locator('[data-testid="version"], .version');
  }

  get healthIndicator(): Locator {
    return this.page.locator('[data-testid="health-status"]');
  }

  get neo4jStatus(): Locator {
    return this.page.locator('text=Neo4j').locator('..').locator('..');
  }

  get lmStudioStatus(): Locator {
    return this.page.locator('text=LM Studio').locator('..').locator('..');
  }

  get ipfsStatus(): Locator {
    return this.page.locator('text=IPFS').locator('..').locator('..');
  }

  get openChatButton(): Locator {
    return this.page.locator('text=Open Chat');
  }

  async goto(): Promise<void> {
    await super.goto(this.path);
  }

  async expectHealthy(): Promise<void> {
    const response = await this.getApiResponse<{ status: string }>('/health');
    expect(response.status).toBe('ok');
  }

  async getVersion(): Promise<string> {
    const response = await this.getApiResponse<{ version: string }>('/api/version');
    return response.version;
  }

  async expectServiceStatus(service: string, expectedStatus: string): Promise<void> {
    let statusLocator: Locator;
    switch (service.toLowerCase()) {
      case 'neo4j':
        statusLocator = this.neo4jStatus;
        break;
      case 'lm studio':
        statusLocator = this.lmStudioStatus;
        break;
      case 'ipfs':
        statusLocator = this.ipfsStatus;
        break;
      default:
        throw new Error(`Unknown service: ${service}`);
    }
    await expect(statusLocator).toContainText(expectedStatus, { ignoreCase: true });
  }
}
