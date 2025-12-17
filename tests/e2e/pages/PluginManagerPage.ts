import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class PluginManagerPage extends BasePage {
  readonly path = '/plugins';

  constructor(page: Page, baseUrl: string) {
    super(page, baseUrl);
  }

  get installedTab(): Locator {
    return this.page.locator('text=Installed');
  }

  get availableTab(): Locator {
    return this.page.locator('text=Available');
  }

  get pluginList(): Locator {
    return this.page.locator('[data-testid="plugin-list"], .plugin-list');
  }

  get installFromUrlButton(): Locator {
    return this.page.locator('text=Install from URL');
  }

  get restartButton(): Locator {
    return this.page.locator('text=Restart');
  }

  async goto(): Promise<void> {
    await super.goto(this.path);
  }

  async goToInstalledTab(): Promise<void> {
    await this.installedTab.click();
  }

  async goToAvailableTab(): Promise<void> {
    await this.availableTab.click();
  }

  async getPluginCard(pluginName: string): Locator {
    return this.page.locator(`[data-plugin="${pluginName}"], :has-text("${pluginName}")`).first();
  }

  async togglePlugin(pluginName: string, enable: boolean): Promise<void> {
    const pluginCard = await this.getPluginCard(pluginName);
    const toggle = pluginCard.locator('input[type="checkbox"], button[role="switch"]');
    const isEnabled = await toggle.isChecked();
    if (isEnabled !== enable) {
      await toggle.click();
    }
  }

  async configurePlugin(pluginName: string): Promise<void> {
    const pluginCard = await this.getPluginCard(pluginName);
    await pluginCard.locator('text=Configure').click();
  }

  async expectPluginInstalled(pluginName: string): Promise<void> {
    await this.goToInstalledTab();
    const pluginCard = await this.getPluginCard(pluginName);
    await expect(pluginCard).toBeVisible();
  }

  async expectBuiltInBadge(pluginName: string): Promise<void> {
    const pluginCard = await this.getPluginCard(pluginName);
    await expect(pluginCard.locator('text=built-in')).toBeVisible();
  }

  async installFromUrl(url: string): Promise<void> {
    await this.installFromUrlButton.click();
    await this.page.fill('input[placeholder*="URL"], input[type="url"]', url);
    await this.page.click('text=Install');
  }
}
