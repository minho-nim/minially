import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { CODE_C } from '../playwright.config';

const D1_DIR = '.wrangler/test-state/v3/d1/miniflare-D1DatabaseObject';

test('월간 보고: C·D 합계, 사람별 비교(지난달 대비), 각자 요약·TOP 3, PDF 서식', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('로그인 코드').fill(CODE_C);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.locator('.scope')).toBeVisible();
  const file = readdirSync(D1_DIR).find(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
  const db = new DatabaseSync(`${D1_DIR}/${file}`);
  const kst = new Date(Date.now() + 9 * 3600000);
  const month = kst.toISOString().slice(0, 7);
  const prev = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const now = Date.now();
  const post = db.prepare('INSERT INTO minilog_posts (user, post_key, blog_id, url, title, published_on, tags, views, likes, comments, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  post.run('C', 'm1', 'cblog', 'https://blog.naver.com/cblog/1', 'C 이번 달 인기 글', `${month}-01`, '카페', 900, 30, 3, now);
  post.run('C', 'm2', 'cblog', 'https://blog.naver.com/cblog/2', 'C 이번 달 둘째 글', `${month}-01`, '카페', 100, 5, 0, now);
  post.run('C', 'm0', 'cblog', 'https://blog.naver.com/cblog/0', 'C 지난달 글', `${prev}-15`, '', 400, 10, 1, now);
  post.run('D', 'm3', 'dblog', 'https://blog.naver.com/dblog/3', 'D 이번 달 글', `${month}-01`, '여행', 250, 12, 2, now);
  db.prepare("INSERT INTO minilog_campaigns (id, user, kind, brand, title, amount, status, paid_on, created_at, updated_at) VALUES ('mr1', 'D', 'ad', '광고 수익', '', 70000, 'paid', ?, ?, ?)").run(`${month}-01`, now, now);
  db.close();
  await page.reload();

  const monthly = page.locator('#monthly');
  await expect(monthly.getByRole('heading', { name: '월간 보고' })).toBeVisible();
  const kpi = (label: string) => monthly.locator('.kpi', { hasText: label });
  await expect(kpi('두 사람 게시한 글').locator('.value')).toHaveText('3개');
  await expect(kpi('두 사람 게시한 글')).toContainText('+2 (▲200%)'); // 지난달 1개
  await expect(kpi('두 사람 조회수 합계').locator('.value')).toHaveText('1,250');
  const row = (label: string) => monthly.locator('.compare tr', { has: page.getByRole('rowheader', { name: label }) });
  await expect(row('게시한 글').locator('td').nth(0)).toContainText('2개');
  await expect(row('게시한 글').locator('td').nth(1)).toContainText('1개');
  await expect(row('조회수 합계').locator('td').nth(0)).toContainText('+600 (▲150%)');
  await expect(row('받은 금액').locator('td').nth(1)).toContainText('70,000원');
  // 칸 색: 늘면 좋음, 비슷하면 보통, AI 줄은 색 없음 + 범례
  await expect(row('조회수 합계').locator('td').nth(0)).toHaveClass(/tone-good/);
  // 다른 시험이 넣은 숫자와 상관없이: AI가 아닌 줄의 칸은 모두 셋 중 하나의 색을 가진다
  for (const label of ['게시한 글', '공감 합계', '받은 금액', '협찬 건수']) for (const cell of await row(label).locator('td').all()) await expect(cell).toHaveClass(/tone-(good|mid|look)/);
  await expect(row('AI 호출').locator('td').nth(0)).not.toHaveClass(/tone-/);
  await expect(monthly.getByLabel('칸 색 설명')).toContainText('살펴보기');
  const personC = monthly.locator('.person', { hasText: '사용자 C' });
  await expect(personC).toContainText("가장 많이 본 글은 'C 이번 달 인기 글'(900회)예요.");
  await expect(personC).toContainText('#카페 글을 2개로 가장 많이 썼어요.');
  await expect(personC.locator('.top3 li').first()).toContainText('C 이번 달 인기 글');

  // 지난달로 가면 그달 숫자
  await monthly.getByRole('button', { name: '지난달' }).click();
  await expect(row('게시한 글').locator('td').nth(0)).toContainText('1개');
  await monthly.getByRole('button', { name: '다음 달' }).click();
  await expect(monthly.getByRole('button', { name: '다음 달' })).toBeDisabled();

  // PDF 서식: 월간 보고만, AI 사용량은 고를 때만
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#overview')).toBeHidden();
  await expect(page.locator('.side')).toBeHidden();
  await expect(monthly.locator('.report-print-head')).toBeVisible();
  await expect(row('받은 금액')).toBeVisible();
  await expect(row('AI 호출')).toBeHidden();
  expect((await page.pdf({ format: 'A4' })).byteLength).toBeGreaterThan(10000);
  await page.emulateMedia({ media: 'screen' });
  await monthly.getByLabel('PDF에 수익').uncheck();
  await page.emulateMedia({ media: 'print' });
  await expect(row('받은 금액')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
});

test('월간 보고 API: 로그인 필요, 잘못된 달 400', async ({ request, page }) => {
  expect((await request.get('/api/report')).status()).toBe(401);
  await page.goto('/');
  await page.getByLabel('로그인 코드').fill(CODE_C);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.locator('.scope')).toBeVisible();
  expect(await page.evaluate(async () => (await fetch('/api/report?month=2026-1')).status)).toBe(400);
  const data = await page.evaluate(async () => (await fetch('/api/report?month=2026-11')).json());
  expect(data.reports.map((r: { user: string }) => r.user)).toEqual(['C', 'D']);
});

test('월별 비교: 사람별 12개월·누적 합계가 각자 월간 보고와 같고, 숫자를 바꿔 볼 수 있다', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('로그인 코드').fill(CODE_C);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.locator('.scope')).toBeVisible();
  const { histories, reports, bad } = await page.evaluate(async () => {
    const h = await (await fetch('/api/history')).json();
    const r = await (await fetch(`/api/report?month=${h.month}`)).json();
    return { histories: h.histories, reports: r.reports, bad: (await fetch('/api/history?month=x')).status };
  });
  expect(bad).toBe(400);
  expect(histories.map((h: { user: string }) => h.user)).toEqual(['C', 'D']);
  for (const [i, h] of histories.entries()) {
    expect(h.months).toHaveLength(12);
    const { month: _m, ...last } = h.months.at(-1);
    expect(last).toEqual(reports[i].summary);
  }
  const box = page.getByRole('region', { name: /월별 비교/ });
  await box.scrollIntoViewIfNeeded();
  await expect(box.getByRole('img', { name: /사람별 월별 게시 글/ })).toBeVisible();
  await expect(box.locator('tbody tr')).toHaveCount(2);
  await expect(box.locator('tbody tr').first()).toContainText(`${histories[0].total.posts.toLocaleString('ko-KR')}`);
  await box.getByRole('button', { name: '받은 금액' }).click();
  await expect(box.getByRole('button', { name: '받은 금액' })).toHaveAttribute('aria-pressed', 'true');
  await expect(box.getByRole('img', { name: /사람별 월별 받은 금액/ })).toBeVisible();
  // 사람별 비교는 통합 대시보드에서만(내 대시보드에는 없음)
  await page.getByRole('button', { name: '나만', exact: true }).click();
  await expect(page.getByRole('region', { name: /월별 비교/ })).toHaveCount(0);
  await page.getByRole('button', { name: '두 사람 같이' }).click();
});

test('월별 비교 API: 로그인 필요', async ({ request }) => {
  expect((await request.get('/api/history')).status()).toBe(401);
});
