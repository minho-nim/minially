import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { CODE_C, CODE_D } from '../playwright.config';

const D1_DIR = '.wrangler/test-state/v3/d1/miniflare-D1DatabaseObject';

test('로그인 후 대시보드에 본인 정보만 보이고 로그아웃된다', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await page.getByLabel('로그인 코드').fill(CODE_D);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('heading', { name: 'D님, 오늘도 반가워요' })).toBeVisible();
  await page.getByRole('button', { name: '나만', exact: true }).click();
  // D는 키가 없어서 연결 안 됨 + 연결 방법 안내
  await expect(page.locator('.kpi .value.off')).toHaveText('연결 안 됨');
  await expect(page.getByText('GEMINI_KEY_D').first()).toBeVisible();
  await expect(page.getByRole('link', { name: '미니로그 열기' })).toHaveAttribute('href', 'https://mini-log.pages.dev');
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
  await page.getByRole('button', { name: '나만', exact: true }).click();
  await expect(page.locator('.kpi .value.ok')).toHaveText('연결됨');
});

test('통합 대시보드에 C·D 합계와 사용자별 숫자가 보이고, 내 대시보드로 바꾸면 내 것만 보인다', async ({ page }) => {
  // 시험용 사용 기록을 로컬 D1에 직접 넣는다(실제 Gemini 호출 없음).
  const file = readdirSync(D1_DIR).find(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
  expect(file).toBeTruthy();
  await page.goto('/');
  await page.getByLabel('로그인 코드').fill(CODE_C);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.locator('.scope')).toBeVisible(); // 로그인하면서 표가 만들어진 뒤에 넣는다
  const db = new DatabaseSync(`${D1_DIR}/${file}`);
  const now = Date.now();
  const insert = db.prepare('INSERT INTO ai_usage (user, app, model, task, input_tokens, output_tokens, status, error_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insert.run('C', 'minilog', 'gemini-2.5-flash', 'draft', 1000, 200, 'ok', null, now);
  insert.run('D', 'minilog', 'gemini-2.5-flash', 'style', 3000, 500, 'ok', null, now);
  insert.run('D', 'minilog', 'gemini-2.5-flash', 'draft', 0, 0, 'error', 'rate_limited', now);
  const today = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  const soon = new Date(now + 9 * 3600000 + 3 * 86400000).toISOString().slice(0, 10);
  const camp = db.prepare("INSERT INTO minilog_campaigns (id, user, kind, brand, title, amount, deadline, status, paid_on, created_at, updated_at) VALUES (?, ?, 'sponsor', ?, ?, ?, ?, ?, ?, ?, ?)");
  camp.run('c1', 'C', '동네빵집', '체험단', 100000, null, 'paid', today, now, now);
  camp.run('c2', 'D', '○○카페', '신메뉴', 50000, soon, 'in_progress', null, now, now);
  db.prepare("INSERT INTO minilog_drafts (id, user, status, published_at, created_at, updated_at) VALUES ('w1', 'D', 'published', ?, ?, ?)").run(now, now, now);
  db.prepare("INSERT INTO minilog_shares (user, draft_id, channel, shared_at) VALUES ('D', 'w1', 'threads', ?), ('D', 'w1', 'x', ?)").run(now, now);
  db.close();
  await page.reload();
  await expect(page.getByRole('button', { name: '두 사람 같이' })).toHaveAttribute('aria-pressed', 'true');
  const kpi = (label: RegExp) => page.locator('.kpi').filter({ hasText: label }).locator('.value');
  await expect(kpi(/전체 AI 호출/)).toHaveText('3');
  await expect(kpi(/전체 토큰/)).toHaveText('4,700');
  await expect(kpi(/Gemini 연결/)).toHaveText('1/2');
  const rowD = page.locator('.user-row').filter({ hasText: '사용자 D' });
  const col = (name: string) => rowD.locator(`td[data-col="${name}"]`);
  await expect(col('calls')).toHaveText('2');
  await expect(col('errors')).toHaveText('1');
  await expect(col('week')).toHaveText('1편'); // 이번 주 게시
  await expect(col('shares')).toHaveText('2'); // 다른 곳 공유(스레드·X)
  // 손볼 것: D는 키가 없고 이번 달 오류가 1번
  await expect(page.getByRole('status', { name: '손볼 것' })).toContainText('사용자 D Gemini 연결 안 됨');
  await expect(page.getByRole('status', { name: '손볼 것' })).toContainText('사용자 D 이번 달 AI 오류 1번');
  await expect(page.getByLabel('오류 종류')).toContainText('호출 제한 1');
  await expect(page.getByRole('list', { name: '작업별 토큰' })).toContainText('문체 분석'); // 표는 접어 두고 그래프로
  await expect(page.getByRole('img', { name: /^사용자별 토큰: .*1,200, .*3,500$/ })).toBeVisible();
  // 오늘 Gemini 사용: 사람·모델별 호출과 한도 오류(호출 제한)
  const todayTable = page.getByRole('table', { name: '오늘 사람·모델별 Gemini 사용' });
  await expect(todayTable.getByRole('row', { name: /사용자 C gemini-2\.5-flash 1 0/ })).toBeVisible();
  await expect(todayTable.getByRole('row', { name: /사용자 D gemini-2\.5-flash 2 1번 \(한도에 걸림\)/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/hub-overview.png', fullPage: true });
  // 협찬·수익: 통합 화면에서 C·D 모두 보임
  const revenue = page.locator('section', { has: page.getByRole('heading', { name: '협찬·광고 수익' }) });
  await expect(revenue.locator('.totals')).toContainText('100,000원');
  await expect(revenue.locator('.totals')).toContainText('50,000원');
  await expect(revenue.locator('.upcoming')).toContainText('○○카페');
  await expect(revenue.locator('.upcoming')).toContainText('D-3');
  await expect(revenue.getByRole('img', { name: /^사용자별 이번 달 받은 금액: .*10만원/ })).toBeVisible();
  // 내 대시보드: C 것만, 새로고침해도 선택 유지
  await page.getByRole('button', { name: '나만', exact: true }).click();
  await expect(page.locator('.kpi').filter({ hasText: /AI 호출/ }).locator('.value')).toHaveText('1');
  await page.reload();
  await expect(page.getByRole('button', { name: '나만', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(async () => (await fetch('/api/overview')).status)).toBe(200);
  const anon = await page.context().browser()!.newContext();
  expect((await anon.request.get(page.url().replace(/\/$/, '') + '/api/overview')).status()).toBe(401);
});

test('통계 API는 맞는 토큰에만 숫자만 내보내고, 세션 API는 로그인해야 한다', async ({ request }) => {
  expect((await request.get('/api/stats')).status()).toBe(401);
  expect((await request.get('/api/stats', { headers: { authorization: 'Bearer wrong' } })).status()).toBe(401);
  const ok = await request.get('/api/stats?since=2020-01-01', { headers: { authorization: 'Bearer test-stats-token' } });
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(Object.keys(body).sort()).toEqual(['errors', 'since', 'usage', 'users']); // Minoffia 통계에는 협찬 정보 없음
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
