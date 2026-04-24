// Playwright configuration for end-to-end tests.
//
// Tests live in tests/e2e and run against an already-running application
// (MySQL + backend + static frontend) on BASE_URL. The usual way to start
// the stack locally is `docker-compose up -d` (port 3000). CI should spin up
// the same compose before invoking `npm run test:e2e`.
//
// Rationale for `reuseExistingServer`: the app requires a MySQL connection
// to start, so we do not let Playwright try to launch the Node process
// standalone. Keeping the app-under-test responsibility outside Playwright
// mirrors how the other test suites run in Docker.

const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
