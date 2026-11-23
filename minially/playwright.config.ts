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
    // 처음 실행 코드 입력 창은 기존 시험 흐름과 무관하므로 건너뛴 상태로 시작한다.
    storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:4177', localStorage: [{ name: 'minially-sync-skip', value: '1' }] }] },
  },
  webServer: {
    command: 'npm run dev -- --port 4177 --host 127.0.0.1',
    url: 'http://127.0.0.1:4177',
    reuseExistingServer: false,
  },
});
