import { defineConfig, devices } from '@playwright/test';

// Browser tests of the public page on an iPhone-sized touch device (Chromium emulation; WebKit is not used in CI).
// They run against the dev server with ?mock=1 (invented data only): no backend, no network to any real site.
export default defineConfig({
  testDir: './e2e',
  testMatch: '*.pw.js',
  timeout: 45_000,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', ...devices['iPhone 13'], browserName: 'chromium' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5174', reuseExistingServer: true, timeout: 60_000 },
});
