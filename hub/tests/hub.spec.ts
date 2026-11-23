import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';

test('로그인 후 대시보드에 본인 정보만 보이고 로그아웃된다', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await page.getByLabel('로그인 코드').fill(CODE_D);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('heading', { name: 'D님, 오늘도 반가워요' })).toBeVisible();
  // D는 키가 없어서 연결 안 됨 + 연결 방법 안내
  await expect(page.locator('.kpi .value.off')).toHaveText('연결 안 됨');
  await expect(page.getByText('GEMINI_KEY_D').first()).toBeVisible();
  await expect(page.getByRole('link', { name: '미니로그 열기' })).toHaveAttribute('href', 'https://minilog.pages.dev');
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByLabel('로그인 코드')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('로그인 코드')).toBeVisible();
  expect(errors).toEqual([]);
});

test('사용자 C는 Gemini 연결됨으로 보인다', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('로그인 코드').fill(CODE_C);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.locator('.kpi .value.ok')).toHaveText('연결됨');
});

test('통계 API는 맞는 토큰에만 숫자만 내보내고, 세션 API는 로그인해야 한다', async ({ request }) => {
  expect((await request.get('/api/stats')).status()).toBe(401);
  expect((await request.get('/api/stats', { headers: { authorization: 'Bearer wrong' } })).status()).toBe(401);
  const ok = await request.get('/api/stats?since=2020-01-01', { headers: { authorization: 'Bearer test-stats-token' } });
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(Object.keys(body).sort()).toEqual(['errors', 'estimated_cost_usd', 'since', 'usage', 'users']);
  expect(body.users).toEqual([{ user: 'C', gemini_connected: true }, { user: 'D', gemini_connected: false }]);
  expect(JSON.stringify(body)).not.toContain('test-key'); // 키 원문은 절대 내보내지 않음
  expect(await (await request.get('/api/me')).json()).toEqual({ user: null });
});

test('코드 해시 도우미는 서버로 보내지 않고 브라우저에서 계산한다', async ({ page }) => {
  const sent: string[] = [];
  page.on('request', r => { if (r.method() !== 'GET') sent.push(r.url()); });
  await page.goto('/code-hash.html');
  await page.getByLabel('미니어리 로그인 코드').fill('testc0de-1234-abcd');
  await page.getByRole('button', { name: '해시 만들기' }).click();
  await expect(page.locator('output')).toHaveText(/^C:[0-9a-f]{64}$/);
  expect(sent).toEqual([]);
});

for (const [name, width] of [['PC', 1400], ['휴대폰', 400]] as const) {
  test(`${name} 폭에서 가로 넘침이 없다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByLabel('로그인 코드').fill(CODE_C);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page.locator('main.main')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
}
