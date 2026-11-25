import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';
import { diffText, shiftMonth, sumSummaries } from '../../shared/client/report';
import { reportComments } from '../../shared/server/report';

test('비교 문구·달 이동·합계 계산', () => {
  expect(diffText(12, 10)).toBe('+2 (▲20%)');
  expect(diffText(5, 10)).toBe('−5 (▼50%)');
  expect(diffText(3, 0)).toBe('+3 (지난달 0)');
  expect(diffText(7, 7)).toBe('지난달과 같아요');
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  const a = { posts: 1, views: 10 } as never; const b = { posts: 2, views: 5 } as never;
  expect(sumSummaries([a, b])).toEqual({ posts: 3, views: 15 });
});

test('규칙 기반 한 줄 평: 숫자로만 문장을 만든다', () => {
  const base = { posts: 0, minilog_published: 0, views: 0, likes: 0, comments: 0, with_stats: 0, revenue: 0, sponsor_revenue: 0, ad_revenue: 0, other_revenue: 0, sponsor_count: 0, ai_calls: 0, ai_tokens: 0, ai_errors: 0 };
  const lines = reportComments({
    month: '2026-11', summary: { ...base, posts: 6, views: 1320, with_stats: 2, revenue: 150000 }, prev: { ...base, posts: 4, views: 1000, revenue: 50000 },
    top: [{ title: '동네 빵집 소금빵 후기', url: 'u', blog_id: 'b', published_on: '2026-11-02', views: 1200, likes: 3, comments: 0 }], tags: [{ tag: '카페', count: 3 }],
  });
  expect(lines).toEqual([
    '글 6개를 올려 지난달보다 2개 늘었어요.',
    '조회수 합계는 1,320회로 지난달보다 ▲32%예요.',
    "가장 많이 본 글은 '동네 빵집 소금빵 후기'(1,200회)예요.",
    '#카페 글을 3개로 가장 많이 썼어요.',
    '받은 금액은 150,000원(지난달 50,000원)이에요.',
    '다음 달엔 크리스마스·연말 모임 글을 미리 준비해 보세요.',
  ]);
  expect(reportComments({ month: '2026-12', summary: base, prev: base, top: [], tags: [] })).toEqual([
    '이 달에는 올린 글이 없어요(블로그 탭에서 글을 가져와야 보여요).', '다음 달엔 새해 계획·설 선물 글을 미리 준비해 보세요.',
  ]);
});

test('월간 보고: 그달 글·조회·공감·수익·지난달 비교, 달 이동, PDF 서식, 본인 것만', async ({ page, browser }) => {
  await login(page, CODE_C);
  // 준비: 블로그 글(11월 RSS) 숫자 적기, 11월·10월 수익
  const ids = await page.evaluate(async () => {
    const send = (url: string, method: string, body: unknown) => fetch(url, { method, body: JSON.stringify(body) }).then(r => r.json());
    await send('/api/blog', 'POST', { blog_id: 'myblog' });
    await send('/api/blog/sync', 'POST', { blog_id: 'myblog' });
    await send('/api/blog/posts/223000000001', 'PUT', { views: '1,200', likes: '30', comments: '4' });
    await send('/api/blog/posts/223000000002', 'PUT', { views: '800', likes: '20', comments: '2' });
    await send('/api/blog/posts/223000000003', 'PUT', { views: '100', likes: '1', comments: '0' }); // 다른 시험이 적은 숫자 덮기
    const made = [
      await send('/api/campaigns', 'POST', { kind: 'sponsor', brand: '보고시험카페', title: '체험단', amount: 150000, status: 'paid', paid_on: '2026-11-05' }),
      await send('/api/campaigns', 'POST', { kind: 'ad', brand: '', amount: 32000, status: 'paid', paid_on: '2026-11-10' }),
      await send('/api/campaigns', 'POST', { kind: 'sponsor', brand: '지난달업체', amount: 50000, status: 'paid', paid_on: '2026-10-20' }),
    ];
    return made.map(m => m.campaign.id as string);
  });
  // 기대값은 지금 저장된 것으로 계산(다른 시험이 남긴 글·수익이 있어도 맞게)
  const expected = await page.evaluate(async () => {
    const blog = await (await fetch('/api/blog')).json();
    const posts = blog.posts.filter((p: { published_on: string }) => p.published_on?.startsWith('2026-11'));
    const camps = (await (await fetch('/api/campaigns')).json()).campaigns.filter((c: { status: string; paid_on: string }) => c.status === 'paid' && c.paid_on?.startsWith('2026-11'));
    return {
      posts: posts.length,
      views: posts.reduce((n: number, p: { views: number | null }) => n + (p.views ?? 0), 0),
      revenue: camps.reduce((n: number, c: { amount: number }) => n + c.amount, 0),
    };
  });
  const api = await page.evaluate(async () => (await (await fetch('/api/report?month=2026-11')).json()).report);
  expect(api.summary.posts).toBe(expected.posts);
  expect(api.summary.views).toBe(expected.views);
  expect(api.summary.revenue).toBe(expected.revenue);
  expect(api.summary.ad_revenue).toBeGreaterThanOrEqual(32000);
  expect(api.top[0].views).toBeGreaterThanOrEqual(api.top[api.top.length - 1].views);
  expect(api.blogs).toContain('myblog');
  expect(api.prev.revenue).toBeGreaterThanOrEqual(50000);
  expect(JSON.stringify(api)).not.toContain('본문 앞부분'); // 글 내용(요약)은 넣지 않음

  // 화면: 2026년 11월로 이동
  await page.getByRole('button', { name: '월간보고', exact: true }).click();
  await expect(page.getByRole('heading', { name: '월간 보고' })).toBeVisible();
  for (let i = 0; i < 36 && (await page.locator('.month-nav .cal-month').innerText()) !== '2026년 11월'; i++) await page.getByRole('button', { name: '지난달' }).click();
  await expect(page.locator('.report-title')).toHaveText('2026년 11월 블로그 보고');
  await expect(page.locator('.kpi', { hasText: '게시한 글' }).locator('.value')).toHaveText(`${expected.posts}개`);
  await expect(page.locator('.kpi', { hasText: '조회수 합계' }).locator('.value')).toHaveText(expected.views.toLocaleString('ko-KR'));
  await expect(page.locator('.kpi', { hasText: '받은 금액' }).locator('.value')).toHaveText(`${expected.revenue.toLocaleString('ko-KR')}원`);
  await expect(page.locator('.top-posts li').first()).toContainText('동네 빵집 소금빵 후기');
  await expect(page.locator('.report-table')).toContainText('겨울 카페 투어 3곳');
  await expect(page.locator('#r-rev').locator('..')).toContainText('보고시험카페');
  await expect(page.locator('.report-head')).toContainText('네이버 myblog');
  await expect(page.locator('.report-summary')).toContainText("가장 많이 본 글은 '동네 빵집 소금빵 후기'");
  await expect(page.locator('.report-summary')).toContainText('다음 달엔 크리스마스·연말 모임');

  // PDF(인쇄 서식): 메뉴·버튼은 빠지고, 수익·AI는 고른 경우만
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.side')).toBeHidden();
  await expect(page.getByRole('button', { name: 'PDF로 저장' })).toBeHidden();
  await expect(page.locator('.report-title')).toBeVisible();
  await expect(page.locator('#r-rev')).toBeHidden();
  await expect(page.locator('#r-ai')).toBeHidden();
  await expect(page.locator('.report-summary li', { hasText: '받은 금액' })).toBeHidden(); // 요약의 수익 문장도
  await page.emulateMedia({ media: 'screen' });
  await page.getByLabel('PDF에 수익 넣기').check();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#r-rev')).toBeVisible();
  await expect(page.locator('#r-ai')).toBeHidden();
  const pdf = await page.pdf({ format: 'A4' });
  expect(pdf.byteLength).toBeGreaterThan(10000);
  await page.emulateMedia({ media: 'screen' });

  // 다른 사용자는 C 숫자를 못 본다, 잘못된 달은 400, 로그인 없으면 401
  const d = await (await browser.newContext()).newPage();
  await login(d, CODE_D);
  const dReport = await d.evaluate(async () => (await (await fetch('/api/report?month=2026-11')).json()).report);
  expect(dReport.summary.revenue).toBe(0);
  expect(dReport.posts).toEqual([]);
  expect(await d.evaluate(async () => (await fetch('/api/report?month=2026-13')).status)).toBe(400);
  expect((await page.request.get('/api/report', { headers: { cookie: '' } })).status()).toBeLessThan(500);

  // 다른 시험에 영향이 없게 수익 기록은 지운다
  await page.evaluate(async list => { for (const id of list) await fetch(`/api/campaigns/${id}`, { method: 'DELETE' }); }, ids);
});

test('월간 보고 API는 로그인 없이 쓸 수 없다', async ({ request }) => {
  expect((await request.get('/api/report')).status()).toBe(401);
  expect((await request.get('/api/history')).status()).toBe(401);
});

test('누적 합계·월별 내역: 12개월, 이번 달 줄은 월간 보고 숫자와 같고, 달을 누르면 그달 보고를 연다', async ({ page }) => {
  await login(page, CODE_C);
  const { history, report, bad } = await page.evaluate(async () => {
    const h = (await (await fetch('/api/history')).json()).history;
    const r = (await (await fetch(`/api/report?month=${h.months.at(-1).month}`)).json()).report;
    return { history: h, report: r, bad: (await fetch('/api/history?month=2026-13')).status };
  });
  expect(bad).toBe(400);
  expect(history.months).toHaveLength(12);
  const { month: _m, ...last } = history.months.at(-1);
  expect(last).toEqual(report.summary);
  expect(history.total.posts).toBeGreaterThanOrEqual(report.summary.posts);
  expect(history.total.revenue).toBeGreaterThanOrEqual(report.summary.revenue);

  await page.getByRole('button', { name: '월간보고' }).click();
  const section = page.getByRole('region', { name: '누적 합계·월별 내역' });
  await expect(section.getByLabel('누적 합계')).toContainText(`${history.total.posts.toLocaleString('ko-KR')}개`);
  await expect(section.locator('tbody tr')).toHaveCount(12);
  const prev = history.months.at(-2).month as string;
  const label = `${prev.slice(0, 4)}년 ${Number(prev.slice(5))}월`;
  await section.getByRole('button', { name: `${label} 보고 보기` }).click();
  await expect(page.locator('.report-title')).toHaveText(`${label} 블로그 보고`);
  await expect(section.locator('tr[aria-current="true"]')).toContainText(prev.slice(2).replace('-', '.'));
  // PDF(인쇄)에는 넣지 않는다
  await page.emulateMedia({ media: 'print' });
  await expect(section).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
});
