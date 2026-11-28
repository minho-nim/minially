import { createHash, generateKeyPairSync } from 'node:crypto';
import { defineConfig } from '@playwright/test';

// 서버까지 포함한 시험: 빌드 결과를 Cloudflare Pages 로컬 서버 + 로컬 D1 + 가짜 Gemini로 띄운다.
export const CODE_C = 'TESTC0DE-1234-ABCD';
export const CODE_D = 'TESTD0DE-5678-WXYZ';
const hash = (code: string) => createHash('sha256').update(code.replace(/-/g, '')).digest('hex');
const PORT = 8812;
const MOCK = 8898;
// 시험용 아침 알림(VAPID) 키: 시험마다 새로 만든다(운영 키와 무관)
const vapid = (() => {
  const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'jwk' }) as { x: string; y: string; d: string };
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);
  return { pub: raw.toString('base64url'), priv: jwk.d };
})();

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 60000,
  use: { baseURL: `http://127.0.0.1:${PORT}`, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' },
  webServer: [
    { command: `node ../shared/testing/mock-gemini.mjs ${MOCK}`, url: `http://127.0.0.1:${MOCK}/health`, reuseExistingServer: false },
    // 가짜 네이버 메일(IMAP 8903·SMTP 8904·조작 8905). 사용자 C만 메일이 연결된 상태로 시험한다
    { command: 'node ../shared/testing/mock-mail.mjs 8903', url: 'http://127.0.0.1:8905/health', reuseExistingServer: false },
    // 가짜 Gmail(IMAP 8913·SMTP 8914·조작 8915). 사용자 C는 네이버·Gmail 둘 다 연결
    { command: 'node ../shared/testing/mock-mail.mjs 8913', url: 'http://127.0.0.1:8915/health', reuseExistingServer: false },
    {
      // 사용자 D는 Gemini 키가 없는 상태로 시험한다.
      command: `rm -rf .wrangler/test-state && npm run build && npx wrangler pages dev dist --ip 127.0.0.1 --port ${PORT} --d1 DB=minihub-test --r2 MINILOG_PHOTOS --persist-to .wrangler/test-state --binding USER_CODE_HASHES=C:${hash(CODE_C)},D:${hash(CODE_D)} GEMINI_KEY_C=test-key GEMINI_API_BASE=http://127.0.0.1:${MOCK} BLOG_RSS_BASE=http://127.0.0.1:${MOCK}/rss NAVER_MAIL_C=c-test@naver.com:app-pass MAIL_TEST_SERVER=127.0.0.1:8903 GMAIL_MAIL_C=c-test@gmail.com:app-pass MAIL_TEST_SERVER_GMAIL=127.0.0.1:8913 MAIL_CRON_TOKEN=test-cron VAPID_PUBLIC_KEY=${vapid.pub} VAPID_PRIVATE_KEY=${vapid.priv} PUSH_TEST_ORIGIN=http://127.0.0.1:${MOCK} GOOGLE_ICS_TEST_ORIGIN=http://127.0.0.1:${MOCK} NAVER_CALDAV_TEST_BASE=http://127.0.0.1:${MOCK}/caldav`,
      url: `http://127.0.0.1:${PORT}/version.json`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
