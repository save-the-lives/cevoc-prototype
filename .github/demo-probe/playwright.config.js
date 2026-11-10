// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: 'demo-probe.spec.js',
  timeout: 120_000,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.FRONTEND_URL || 'https://calm-water-028cfd500.3.azurestaticapps.net',
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit-iphone',
      use: { ...devices['iPhone 14'] },
    },
  ],
});
