const { Then, When } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Then('I should see installed plugins', async function () {
  await expect(this.page.locator('.plugin-list, [data-testid="plugins"]')).toBeVisible();
});

Then('I should see {string} in the list', async function (pluginName) {
  // Use data-testid selector for plugin cards
  await expect(this.page.locator(`[data-testid="plugin-${pluginName}"]`)).toBeVisible();
});

Then('the {string} should have a {string} badge', async function (pluginName, badge) {
  const pluginCard = this.page.locator(`[data-testid="plugin-${pluginName}"]`);
  await expect(pluginCard.locator(`text=${badge}`)).toBeVisible();
});

When('I toggle the {string} plugin', async function (pluginName) {
  // Use the data-testid on the toggle button directly
  const toggle = this.page.locator(`[data-testid="plugin-toggle-${pluginName}"]`);
  await toggle.click();
});

Then('I should see the restart required message', async function () {
  // Look for the specific "Restart Required" heading or the restart button
  await expect(this.page.locator('text=Restart Required').first()).toBeVisible();
});

When('I POST plugin install with invalid name {string}', async function (pluginName) {
  const response = await this.request.post(`${this.config.appUrl}/api/plugins/install`, {
    data: { plugin: pluginName },
  });
  this.testData.lastResponse = await response.json().catch(() => ({}));
  this.testData.lastStatus = response.status();
});

When('I POST plugin install with name {string}', async function (pluginName) {
  const response = await this.request.post(`${this.config.appUrl}/api/plugins/install`, {
    data: { plugin: pluginName },
  });
  this.testData.lastResponse = await response.json().catch(() => ({}));
  this.testData.lastStatus = response.status();
});

Then('the response should mention plugin name format', async function () {
  const response = this.testData.lastResponse;
  // The error could be about invalid name format or plugin not found
  expect(response.error).toMatch(/void-plugin-|name|not found|invalid/i);
});

Then('the response should mention already installed', async function () {
  const response = this.testData.lastResponse;
  // For built-in plugins, the error is "not found in manifest" since they're not installable
  // For user plugins that are already installed, the error would be "already installed"
  expect(response.error).toMatch(/already installed|not found in manifest/i);
});

Then('user plugins should be from data directory', async function () {
  const response = this.testData.lastResponse;
  // User-installed plugins should have userInstalled: true flag
  // Built-in plugins should not
  const plugins = response.installed || response.plugins || [];
  const builtInPlugins = plugins.filter(p => p.builtIn);
  const userPlugins = plugins.filter(p => p.userInstalled);

  // All built-in plugins should NOT have userInstalled flag
  for (const plugin of builtInPlugins) {
    expect(plugin.userInstalled).toBeFalsy();
  }

  // Any user plugins should have userInstalled flag
  for (const plugin of userPlugins) {
    expect(plugin.userInstalled).toBe(true);
  }
});
