import { createHash } from 'crypto';
import { defineConfig } from '@playwright/test';

// 서버까지 포함한 시험(로그인·PC·폰 동기화·공유): 빌드 결과를 Cloudflare Pages 로컬 서버 + 로컬 D1로 띄운다.
// 실행: npm run test:sync
export const CODE_A = 'TESTC0DE-1234-ABCD';
export const CODE_B = 'TESTC0DE-5678-WXYZ';
export const CODE_NOTES = 'TESTN0TE-1234-ABCD';
export const CODE_CONFLICT = 'TESTC0NF-1234-ABCD';
/** 미니허브에만 있는 코드(SYNC_CODE_HASHES에는 없음): 허브 기준으로 로그인되는지 */
export const CODE_HUB_ONLY = 'TESTHUB0-1234-ABCD';
const hash = (code: string) => createHash('sha256').update(code.replace(/-/g, '')).digest('hex');
const PORT = 8799;
const MOCK = 8897;

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
  // 가짜 Gemini(실제 API·크레딧 없음): 사진으로 일정 넣기 시험용. CODE_A는 미니허브 사용자 C로도, CODE_HUB_ONLY는 미니허브에만(사용자 D) 둔다.
  webServer: [
    { command: `node ../shared/testing/mock-gemini.mjs ${MOCK}`, url: `http://127.0.0.1:${MOCK}/health`, reuseExistingServer: false },
    {
      command: `rm -rf .wrangler/test-state && npm run build && npx wrangler pages dev dist --ip 127.0.0.1 --port ${PORT} --d1 DB=minially-test --persist-to .wrangler/test-state --binding SYNC_CODE_HASHES=${hash(CODE_A)},${hash(CODE_B)},${hash(CODE_NOTES)},${hash(CODE_CONFLICT)} USER_CODE_HASHES=C:${hash(CODE_A)},D:${hash(CODE_HUB_ONLY)} GEMINI_KEY_C=test-key GEMINI_API_BASE=http://127.0.0.1:${MOCK} GOOGLE_ICS_TEST_ORIGIN=http://127.0.0.1:${MOCK}`,
      url: `http://127.0.0.1:${PORT}/version.json`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
