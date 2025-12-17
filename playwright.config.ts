import { defineConfig, devices } from '@playwright/test';

const isDocker = process.env.TEST_ENV === 'docker';
const isCI = process.env.CI === 'true';

// Port configuration based on environment
const ports = {
  native: { app: 4401 },
  docker: { app: 4420 },
};

const currentPorts = isDocker ? ports.docker : ports.native;
const baseURL = `http://localhost:${currentPorts.app}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: !isCI,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'tests/e2e/reports/html' }],
    ['json', { outputFile: 'tests/e2e/reports/results.json' }],
    isCI ? ['github'] : ['list'],
  ],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'off',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--remote-debugging-port=0'],
        },
      },
    },
  ],

  timeout: 60000,

  expect: {
    timeout: 10000,
  },

  outputDir: 'tests/e2e/reports/screenshots',

  webServer: isCI
    ? undefined
    : {
        command: isDocker
          ? 'docker compose -f docker-compose.test.yml up'
          : 'npm start',
        url: `${baseURL}/health`,
        reuseExistingServer: true,
        timeout: 120000,
      },
});
