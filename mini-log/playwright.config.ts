import { createHash } from 'node:crypto';
import { defineConfig } from '@playwright/test';

// 서버까지 포함한 시험: 빌드 결과를 Cloudflare Pages 로컬 서버 + 로컬 D1 + 가짜 Gemini로 띄운다.
export const CODE_C = 'TESTC0DE-1234-ABCD';
export const CODE_D = 'TESTD0DE-5678-WXYZ';
const hash = (code: string) => createHash('sha256').update(code.replace(/-/g, '')).digest('hex');
const PORT = 8812;
const MOCK = 8898;

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 60000,
  use: { baseURL: `http://127.0.0.1:${PORT}`, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' },
  webServer: [
    { command: `node ../shared/testing/mock-gemini.mjs ${MOCK}`, url: `http://127.0.0.1:${MOCK}/health`, reuseExistingServer: false },
    {
      // 사용자 D는 Gemini 키가 없는 상태로 시험한다.
      command: `rm -rf .wrangler/test-state && npm run build && npx wrangler pages dev dist --ip 127.0.0.1 --port ${PORT} --d1 DB=minihub-test --r2 MINILOG_PHOTOS --persist-to .wrangler/test-state --binding USER_CODE_HASHES=C:${hash(CODE_C)},D:${hash(CODE_D)} GEMINI_KEY_C=test-key GEMINI_API_BASE=http://127.0.0.1:${MOCK} BLOG_RSS_BASE=http://127.0.0.1:${MOCK}/rss`,
      url: `http://127.0.0.1:${PORT}/version.json`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
