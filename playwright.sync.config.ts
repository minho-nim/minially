import { createHash } from 'crypto';
import { defineConfig } from '@playwright/test';

// 서버까지 포함한 시험(로그인·PC·폰 동기화·공유): 빌드 결과를 Cloudflare Pages 로컬 서버 + 로컬 D1로 띄운다.
// 실행: npm run test:sync
export const CODE_A = 'TESTC0DE-1234-ABCD';
export const CODE_B = 'TESTC0DE-5678-WXYZ';
const hash = (code: string) => createHash('sha256').update(code.replace(/-/g, '')).digest('hex');
const PORT = 8799;

export default defineConfig({
  testDir: './tests-sync',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `rm -rf .wrangler/test-state && npm run build && npx wrangler pages dev dist --ip 127.0.0.1 --port ${PORT} --d1 DB=minially-test --persist-to .wrangler/test-state --binding SYNC_CODE_HASHES=${hash(CODE_A)},${hash(CODE_B)}`,
    url: `http://127.0.0.1:${PORT}/version.json`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
