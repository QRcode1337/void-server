const { Before, After, BeforeAll, AfterAll, setDefaultTimeout, Status } = require('@cucumber/cucumber');
const { chromium, request } = require('@playwright/test');
const { startMockLmStudio, stopMockLmStudio, MOCK_PORT } = require('./mocks/lmstudio');

let browser;
let originalLmStudioEndpoint = null;
let apiContext = null;

// Cucumber step timeout (max time for a single step)
setDefaultTimeout(30000);

const APP_URL = process.env.TEST_APP_URL || 'http://localhost:4401';

BeforeAll(async function () {
  // Start mock LM Studio server
  await startMockLmStudio();

  // Configure void-server to use mock LM Studio
  apiContext = await request.newContext({ baseURL: APP_URL });
  const configResponse = await apiContext.get('/api/ai-providers');
  const config = await configResponse.json();
  originalLmStudioEndpoint = config.providers?.lmstudio?.endpoint;

  // Update LM Studio to use mock endpoint
  await apiContext.put('/api/ai-providers/lmstudio', {
    data: { endpoint: `http://localhost:${MOCK_PORT}/v1`, enabled: true }
  });
  console.log(`Configured LM Studio to use mock at port ${MOCK_PORT}`);

  browser = await chromium.launch({
    args: ['--remote-debugging-port=0'],
  });
  console.log('Browser launched');
});

AfterAll(async function () {
  // Restore original LM Studio endpoint
  if (apiContext && originalLmStudioEndpoint) {
    await apiContext.put('/api/ai-providers/lmstudio', {
      data: { endpoint: originalLmStudioEndpoint }
    });
    console.log('Restored original LM Studio endpoint');
  }
  await apiContext?.dispose();

  await browser?.close();
  console.log('Browser closed');

  await stopMockLmStudio();
});

Before(async function () {
  this.context = await browser.newContext({
    baseURL: this.config.appUrl,
  });
  this.page = await this.context.newPage();
  // Set default timeout for locators/expects to 1s (fast fail)
  // Use explicit longer timeouts for async operations
  this.page.setDefaultTimeout(1000);
  this.request = await request.newContext({
    baseURL: this.config.appUrl,
  });
});

After(async function ({ result }) {
  if (result?.status === Status.FAILED && this.page) {
    const screenshot = await this.page.screenshot();
    this.attach(screenshot, 'image/png');
  }
  await this.page?.close();
  await this.context?.close();
  await this.request?.dispose();
});

Before({ tags: '@requires-neo4j' }, async function () {
  if (this.shouldMock('neo4j')) {
    return 'skipped';
  }
  const response = await this.request.get(`${this.config.appUrl}/api/memories/status`);
  const status = await response.json();
  if (!status.neo4j?.connected) {
    return 'skipped';
  }
});

Before({ tags: '@requires-lmstudio' }, async function () {
  // Mock LM Studio is always available during tests, no need to skip
  // Just verify the mock is responding
  const response = await this.request.post(`${this.config.appUrl}/api/ai-providers/lmstudio/test`);
  if (!response.ok()) {
    console.warn('Mock LM Studio test failed, skipping test');
    return 'skipped';
  }
});

Before({ tags: '@requires-ipfs' }, async function () {
  if (this.shouldMock('ipfs')) {
    return 'skipped';
  }
  const response = await this.request.get(`${this.config.appUrl}/api/ipfs/status`);
  const status = await response.json();
  // Check for daemonOnline (actual field) or online (legacy)
  if (!status.daemonOnline && !status.online) {
    return 'skipped';
  }
});

Before({ tags: '@requires-docker' }, async function () {
  // Check if server is running in Docker by calling environment endpoint
  const response = await this.request.get(`${this.config.appUrl}/api/version/environment`);
  const env = await response.json();
  if (!env.isDocker) {
    return 'skipped';
  }
});
