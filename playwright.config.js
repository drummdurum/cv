const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3010',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm start',
    url: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3010',
    reuseExistingServer: true,
    timeout: 30000
  }
});
