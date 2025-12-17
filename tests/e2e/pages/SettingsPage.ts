import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class SettingsPage extends BasePage {
  readonly path = '/settings';

  constructor(page: Page, baseUrl: string) {
    super(page, baseUrl);
  }

  get generalTab(): Locator {
    return this.page.locator('text=General');
  }

  get providersTab(): Locator {
    return this.page.locator('text=Providers');
  }

  get themeSelector(): Locator {
    return this.page.locator('[data-testid="theme-selector"], .theme-selector');
  }

  get autoCollapseToggle(): Locator {
    return this.page.locator('text=Auto-collapse navigation').locator('..').locator('input, button');
  }

  async goto(tab?: string): Promise<void> {
    const path = tab ? `${this.path}/${tab}` : this.path;
    await super.goto(path);
  }

  async selectTheme(themeName: string): Promise<void> {
    await this.page.click(`text=${themeName}`);
  }

  async goToGeneralTab(): Promise<void> {
    await this.generalTab.click();
  }

  async goToProvidersTab(): Promise<void> {
    await this.providersTab.click();
  }

  async toggleProvider(providerId: string, enable: boolean): Promise<void> {
    const providerCard = this.page.locator(`[data-provider="${providerId}"], text=${providerId}`);
    const toggle = providerCard.locator('input[type="checkbox"], button[role="switch"]');
    const isEnabled = await toggle.isChecked();
    if (isEnabled !== enable) {
      await toggle.click();
    }
  }

  async testProviderConnection(providerId: string): Promise<void> {
    const providerCard = this.page.locator(`[data-provider="${providerId}"]`);
    await providerCard.locator('text=Test Connection').click();
  }

  async expectProviderEnabled(providerId: string): Promise<void> {
    const providerCard = this.page.locator(`[data-provider="${providerId}"]`);
    await expect(providerCard.locator('.enabled, text=Enabled')).toBeVisible();
  }
}
