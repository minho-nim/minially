import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { CODE_C } from '../playwright.config';

const D1_DIR = '.wrangler/test-state/v3/d1/miniflare-D1DatabaseObject';
const dbFile = () => `${D1_DIR}/${readdirSync(D1_DIR).find(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite')}`;

test('로그인 화면: 코드 입력 안내, 브라우저 비밀번호 저장을 쓸 수 있는 칸', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('코드를 입력해 주세요')).toBeVisible();
  await expect(page.getByText('미니어리 코드로 들어와요')).toHaveCount(0);
  const code = page.getByLabel('로그인 코드');
  await expect(code).toHaveAttribute('type', 'password');
  await expect(code).toHaveAttribute('autocomplete', 'current-password');
  await page.getByRole('button', { name: '보기' }).click();
  await expect(code).toHaveAttribute('type', 'text');
});

test('설정: 이름 바꾸기·화면 테마·처음 볼 대시보드, 잘못된 이름은 거절', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('로그인 코드').fill(CODE_C);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('heading', { name: 'C님, 오늘도 반가워요' })).toBeVisible();

  await page.getByLabel('이름', { exact: true }).fill('토마토');
  await page.getByRole('button', { name: '이름 바꾸기' }).click();
  await expect(page.getByRole('status').filter({ hasText: '이름을 바꿨어요' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '토마토님, 오늘도 반가워요' })).toBeVisible();
  await expect(page.locator('.user-row', { hasText: '토마토' })).toBeVisible(); // 통합 대시보드에도
  await expect(page.locator('#monthly .compare thead')).toContainText('토마토');
  await page.reload();
  await expect(page.getByRole('heading', { name: '토마토님, 오늘도 반가워요' })).toBeVisible();

  // 잘못된 이름: 꺾쇠·너무 김·빈칸
  const bad = await page.evaluate(async () => Promise.all(['<b>x</b>', 'ㄱ'.repeat(21), '   '].map(async name => (await fetch('/api/settings', { method: 'PUT', body: JSON.stringify({ name }) })).status)));
  expect(bad).toEqual([400, 400, 400]);
  expect(await page.evaluate(async () => (await fetch('/api/settings', { method: 'PUT', body: JSON.stringify({ theme: 'pink' }) })).status)).toBe(400);

  // 화면 테마: 어둡게 → 기기 설정과 상관없이 어두운 색, 새로고침해도 유지
  await page.getByRole('button', { name: '어둡게' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(27, 23, 25)');
  await page.getByRole('button', { name: '기기 설정 따라' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);

  // 처음 볼 대시보드(이 기기)
  await page.locator('.settings-card').getByRole('button', { name: '내 것만' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '내 대시보드' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.settings-card').getByRole('button', { name: '통합' }).click();

  // 다른 시험에 영향이 없게 이름을 되돌린다
  await page.evaluate(async () => { await fetch('/api/settings', { method: 'PUT', body: JSON.stringify({ name: '사용자 C' }) }); });
});

test('로그인 유지: 쓰는 동안 만료가 다가오면 기간을 다시 늘린다', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('로그인 코드').fill(CODE_C);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.locator('.scope')).toBeVisible();
  const db = new DatabaseSync(dbFile());
  const soon = Date.now() + 86400000;
  db.prepare("UPDATE hub_sessions SET expires_at = ? WHERE user = 'C' AND app = 'hub'").run(soon);
  db.close();
  const response = await page.request.get('/api/me');
  expect(response.headers()['set-cookie']).toMatch(/Max-Age=2592000/);
  const db2 = new DatabaseSync(dbFile());
  const row = db2.prepare("SELECT MAX(expires_at) AS e FROM hub_sessions WHERE user = 'C' AND app = 'hub'").get() as { e: number };
  db2.close();
  expect(row.e).toBeGreaterThan(Date.now() + 29 * 86400000);
  // 넉넉하면 다시 쓰지 않는다
  expect((await page.request.get('/api/me')).headers()['set-cookie']).toBeUndefined();
});

test('설정 API는 로그인 없이 쓸 수 없다', async ({ request }) => {
  expect((await request.put('/api/settings', { data: { name: 'x' } })).status()).toBe(401);
});
