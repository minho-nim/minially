import { expect, test, type Page } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';
import { checkDraft, qualityCheck } from '../src/DraftCheck';

const kst = (days: number) => new Date(Date.now() + 9 * 3600000 + days * 86400000).toISOString().slice(0, 10);
const call = (page: Page, path: string, method = 'GET', body?: unknown) => page.evaluate(async ([p, m, b]) => {
  const r = await fetch(p as string, { method: m as string, headers: { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) });
  return { status: r.status, data: await r.json().catch(() => null) };
}, [path, method, body] as const);

test('선정되면 가이드가 붙은 빈 원고를 마감 전날에 준비하고, 이미 원고가 있으면 만들지 않는다', async ({ page }) => {
  await login(page, CODE_C);
  const c = (await call(page, '/api/campaigns', 'POST', { brand: '준비빵집', title: '겨울 체험단', status: 'proposed', deadline: kst(6), guide: { hashtags: ['준비빵집', '겨울빵'], keywords: ['소금빵'] } })).data.campaign;
  const put = await call(page, `/api/campaigns/${c.id}`, 'PUT', { status: 'in_progress' });
  expect(put.data.prepared_draft).toMatchObject({ planned_on: kst(5) });
  const draftId = put.data.campaign.draft_id;
  expect(draftId).toBe(put.data.prepared_draft.id);
  const draft = (await call(page, `/api/drafts/${draftId}`)).data.draft;
  expect(draft).toMatchObject({ title: '준비빵집 겨울 체험단', hashtags: ['준비빵집', '겨울빵'], post_type: 'sponsored', planned_on: kst(5), body: '' });
  // 다시 진행 중으로 들어와도(원고가 이미 있으면) 새로 만들지 않는다
  await call(page, `/api/campaigns/${c.id}`, 'PUT', { status: 'proposed' });
  expect((await call(page, `/api/campaigns/${c.id}`, 'PUT', { status: 'in_progress' })).data.prepared_draft).toBeNull();
  // 마감이 지난 협찬은 날짜 없이 준비
  const late = (await call(page, '/api/campaigns', 'POST', { brand: '지난마감상점', status: 'proposed', deadline: kst(-2) })).data.campaign;
  const lateDraft = (await call(page, `/api/campaigns/${late.id}`, 'PUT', { status: 'in_progress' })).data.prepared_draft;
  expect(lateDraft.planned_on).toBeNull();
  for (const id of [c.id, late.id]) await call(page, `/api/campaigns/${id}`, 'DELETE');
  for (const id of [draftId, lateDraft.id]) await call(page, `/api/drafts/${id}`, 'DELETE');
});

test('정산 챙기기: 게시 14일이 지나면 브리핑에 입금 확인, 정산 확인·게시 보고 메일 초안을 새 메일에 채운다(보내지 않음)', async ({ page, browser }) => {
  await login(page, CODE_C);
  const c = (await call(page, '/api/campaigns', 'POST', { brand: '정산카페', title: '라떼 리뷰', status: 'in_progress', amount: 50000 })).data.campaign;
  // 게시 완료로 바꾸면 오늘이 게시일
  const posted = (await call(page, `/api/campaigns/${c.id}`, 'PUT', { status: 'posted' })).data.campaign;
  expect(posted.posted_on).toBe(kst(0));
  const items = async () => (await call(page, '/api/brief')).data.items.filter((i: { title: string }) => i.title.startsWith('정산카페'));
  expect(await items()).toEqual([]);
  await call(page, `/api/campaigns/${c.id}`, 'PUT', { posted_on: kst(-15) });
  expect(await items()).toEqual([{ kind: 'payment', title: '정산카페 입금 확인', sub: '게시 15일 지남', target: 'campaigns', rank: 25 }]);

  // 메일 초안: 금액은 실제 기록, 받는 사람은 받은 메일이 없어 빈칸
  const pay = (await call(page, `/api/campaigns/${c.id}/mail`, 'POST', { kind: 'payment' })).data;
  expect(pay.subject).toBe('[정산카페] 원고료 정산 확인 부탁드려요');
  expect(pay.text).toContain('금액: 50,000원');
  expect(pay.to).toBe('');
  const report = (await call(page, `/api/campaigns/${c.id}/mail`, 'POST', { kind: 'report' })).data;
  expect(report.subject).toBe('[정산카페] 리뷰 게시 안내 드려요');
  expect(report.text).not.toContain('조회수'); // 기록이 없으면 지어내지 않는다
  expect((await call(page, `/api/campaigns/${c.id}/mail`, 'POST', { kind: 'spam' })).status).toBe(400);
  const other = await browser.newPage();
  await login(other, CODE_D);
  expect((await call(other, `/api/campaigns/${c.id}/mail`, 'POST', { kind: 'payment' })).status).toBe(404);
  await other.close();

  // 화면: 협찬 목록의 버튼 → 메일 화면 새 메일에 채워짐
  await page.goto('/#campaigns');
  await page.getByRole('button', { name: '게시 15일, 입금 확인 메일' }).click();
  const compose = page.getByRole('region', { name: '새 메일 쓰기' });
  await expect(compose).toBeVisible();
  await expect(compose.getByLabel('제목')).toHaveValue('[정산카페] 원고료 정산 확인 부탁드려요');
  await expect(compose).toContainText('50,000원');

  await call(page, `/api/campaigns/${c.id}`, 'DELETE');
});

test('협찬 단계판: 칸마다 건수·금액, ‹ › 버튼과 끌어 놓기로 옮기고, 진행 중으로 오면 원고 준비, 단계판 보기를 기억', async ({ page }) => {
  await login(page, CODE_C);
  const c = (await call(page, '/api/campaigns', 'POST', { brand: '단계판상점', status: 'applied', amount: 30000, deadline: kst(9) })).data.campaign;
  await page.goto('/#campaigns');
  await page.getByRole('tab', { name: '단계판' }).click();
  const board = page.getByLabel('협찬 단계판');
  const col = (name: string) => board.getByRole('region', { name: new RegExp(`^${name} \\d+건$`) });
  await expect(col('신청함').getByRole('button', { name: '단계판상점 고치기' })).toBeVisible();
  // 버튼으로 다음 칸(제안 받음)
  await col('신청함').getByRole('button', { name: '단계판상점 제안 받음(으)로' }).click();
  await expect(col('제안 받음').getByRole('button', { name: '단계판상점 고치기' })).toBeVisible();
  // 끌어 놓기로 진행 중 → 원고 준비 알림
  await col('제안 받음').locator('.board-card', { hasText: '단계판상점' }).dragTo(col('진행 중'));
  await expect(col('진행 중').getByRole('button', { name: '단계판상점 고치기' })).toBeVisible();
  await expect(page.getByText(/단계판상점: 진행 중\(으\)로 옮겼어요\. 가이드·필수 해시태그를 넣은 빈 원고를/)).toBeVisible();
  // 다시 열어도 단계판
  await page.reload();
  await expect(page.getByLabel('협찬 단계판')).toBeVisible();
  // 휴대폰 폭: 화면 전체는 옆으로 넘치지 않는다(단계판 안에서만 옆으로 넘김)
  await page.setViewportSize({ width: 390, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.getByRole('tab', { name: '진행 중' }).click(); // 다른 시험을 위해 목록 보기로 되돌림

  const draftId = (await call(page, '/api/campaigns')).data.campaigns.find((x: { id: string }) => x.id === c.id).draft_id;
  await call(page, `/api/campaigns/${c.id}`, 'DELETE');
  if (draftId) await call(page, `/api/drafts/${draftId}`, 'DELETE');
});

test('협찬 글 점검: 광고 표시는 제목이나 앞부분에, 가이드 금지 표현, 가이드 없어도 협찬 연결이면 표시 문구를 본다', () => {
  const ad = (body: string, title = '성수 카페 후기', extra: { sponsored?: boolean; postType?: string } = { sponsored: true }) =>
    qualityCheck({ title, body, hashtags: [], photos: 0, ...extra }, null).find(i => i.label === '광고·협찬 표시 문구');
  expect(ad('업체로부터 제공받아 솔직하게 썼어요. 맛있었어요.')?.ok).toBe(true);
  const late = ad(`${'맛있어요. '.repeat(80)}업체로부터 제공받아 작성했어요.`);
  expect(late).toMatchObject({ ok: false, hint: expect.stringContaining('뒤쪽에만 있어요') });
  expect(ad('맛있어요.', '[협찬] 성수 카페 후기')?.ok).toBe(true); // 제목에 있으면 통과
  expect(ad('맛있어요.', '성수 카페', {})).toBeUndefined(); // 협찬 연결도 글 종류도 아니면 안 봄
  const guide = { keywords: [], hashtags: [], min_photos: null, min_chars: null, links: [], visit_on: null, notes: '', avoid: ['스타벅스'] };
  const avoid = (body: string) => checkDraft({ title: 't', body, hashtags: [], photos: 0 }, guide).find(i => i.label === "쓰지 말 것 '스타벅스'")?.ok;
  expect(avoid('근처 스타 벅스보다 좋아요')).toBe(false);
  expect(avoid('조용하고 좋아요')).toBe(true);
});
