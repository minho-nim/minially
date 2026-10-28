import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  use: {
    serviceWorkers: 'block',
    baseURL: 'http://127.0.0.1:4177',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 4177 --host 127.0.0.1',
    url: 'http://127.0.0.1:4177',
    reuseExistingServer: false,
  },
});
