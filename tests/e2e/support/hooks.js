const { Before, After, BeforeAll, AfterAll, setDefaultTimeout, Status } = require('@cucumber/cucumber');
const { chromium, request } = require('@playwright/test');

let browser;

setDefaultTimeout(60000);

BeforeAll(async function () {
  browser = await chromium.launch({
    args: ['--remote-debugging-port=0'],
  });
  console.log('Browser launched');
});

AfterAll(async function () {
  await browser?.close();
  console.log('Browser closed');
});

Before(async function () {
  this.context = await browser.newContext({
    baseURL: this.config.appUrl,
  });
  this.page = await this.context.newPage();
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
  if (this.shouldMock('lmstudio')) {
    return 'skipped';
  }
  const response = await this.request.get(`${this.config.appUrl}/api/ai-providers/lmstudio/test`);
  if (!response.ok()) {
    return 'skipped';
  }
});

Before({ tags: '@requires-ipfs' }, async function () {
  if (this.shouldMock('ipfs')) {
    return 'skipped';
  }
  const response = await this.request.get(`${this.config.appUrl}/api/ipfs/status`);
  const status = await response.json();
  if (!status.online) {
    return 'skipped';
  }
});
