import { expect, test, type Page } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';
import { checkDraft, qualityCheck } from '../src/DraftCheck';
import { replyPrompt } from '../functions/_mailRules';
import { historyText } from '../functions/_sponsorFlow';
import { statsAge } from '../src/proposalKit';

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

test('업체별 기록: 같은 업체와 했던 협찬을 편집 칸에 보이고, 조건 협의 답장 안에는 참고 자료로만 넘긴다', async ({ page, browser }) => {
  // 답장 프롬프트: 지난 협찬은 태그로 감싼 자료, 금액을 정하지 않는다는 규칙
  const withPast = replyPrompt('서명', [{ id: 'm1', from: 'a <a@b.kr>', subject: '제안', text: '본문', kind: 'offer', history: historyText([{ id: 'x', title: '여름 체험', amount: 40000, status: 'paid', on: '2026-07-10', draft_id: null, views: 1234 }]) }]);
  expect(withPast).toContain('<지난 협찬>\n2026-07 여름 체험 · 원고료 40,000원 · 정산 완료 · 조회 1,234\n</지난 협찬>');
  expect(withPast).toContain('금액·조건을 정하거나 약속하지 않는다');
  expect(replyPrompt('서명', [{ id: 'm1', from: 'a', subject: 's', text: 't', kind: 'offer' }])).not.toContain('<지난 협찬>\n');

  await login(page, CODE_C);
  const old = (await call(page, '/api/campaigns', 'POST', { brand: '기록빵집', title: '여름 체험', status: 'paid', amount: 40000, paid_on: '2026-07-20' })).data.campaign;
  const now = (await call(page, '/api/campaigns', 'POST', { brand: '기록빵집 성수점', title: '겨울 체험', status: 'proposed' })).data.campaign;
  const past = (await call(page, `/api/campaigns/history?brand=${encodeURIComponent('기록빵집 성수점')}&except=${now.id}`)).data.past;
  expect(past).toEqual([expect.objectContaining({ id: old.id, title: '여름 체험', amount: 40000, status: 'paid', on: '2026-07-20' })]);
  expect((await call(page, '/api/campaigns/history?brand=x')).data.past).toEqual([]);
  const other = await browser.newPage();
  await login(other, CODE_D);
  expect((await call(other, `/api/campaigns/history?brand=${encodeURIComponent('기록빵집')}`)).data.past).toEqual([]); // 남의 기록은 안 보임
  await other.close();

  // 화면: 고치는 칸에 지난 협찬
  await page.goto('/#campaigns');
  await page.getByRole('tab', { name: '진행 중' }).click();
  await page.getByRole('button', { name: '기록빵집 성수점 겨울 체험 고치기' }).click();
  await expect(page.getByRole('group', { name: '이 업체와 지난 협찬' })).toContainText('26.07 · 여름 체험 · 40,000원 · 정산 완료');

  for (const id of [old.id, now.id]) await call(page, `/api/campaigns/${id}`, 'DELETE');
});

test('제안서 숫자 기준일: 조회수 기록의 가장 최근 날을 돌려주고, 며칠 묵었는지 센다', async ({ page }) => {
  expect(statsAge('2026-10-01', '2026-11-28')).toBe(58);
  expect(statsAge(null)).toBeNull();
  await login(page, CODE_C);
  const stats = (await call(page, '/api/proposal')).data.stats;
  expect('stats_on' in stats).toBe(true);
  if (stats.stats_on !== null) expect(stats.stats_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('내 이름 바꾸기: 미니로그 설정에서 바꾸면 인사말에도 보이고(미니허브와 같은 값), 잘못된 이름은 거절', async ({ page, request }) => {
  expect((await request.put('/api/me', { data: { name: '해커' } })).status()).toBe(401);
  await login(page, CODE_C);
  for (const bad of ['', '   ', '<b>이름</b>', '가'.repeat(21)]) expect((await call(page, '/api/me', 'PUT', { name: bad })).status).toBe(400);
  await page.goto('/#settings');
  const card = page.getByRole('region', { name: '내 이름' });
  await card.getByLabel('화면에 보일 이름').fill('민호');
  await card.getByRole('button', { name: '이름 바꾸기' }).click();
  await expect(card).toContainText('이름을 바꿨어요');
  expect((await call(page, '/api/me')).data.name).toBe('민호');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /좋은 하루예요, 민호님/ })).toBeVisible();
  await call(page, '/api/me', 'PUT', { name: '사용자 C' }); // 다른 시험을 위해 되돌림
});

test('메일 화면 폭 조절: 끌거나 ←→로 목록 폭을 바꾸고 이 기기에 기억, 휴대폰에서는 손잡이 없음', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page, CODE_C);
  await page.goto('/#mail');
  const handle = page.getByRole('separator', { name: '메일 목록 폭' });
  await expect(handle).toHaveAttribute('aria-valuenow', '340');
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', '380');
  const list = page.getByRole('complementary', { name: '메일 목록' });
  expect(Math.round((await list.boundingBox())!.width)).toBe(380);
  // 끌어서 줄이기
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x - 80, box.y + 40, { steps: 5 });
  await page.mouse.up();
  const dragged = Number(await handle.getAttribute('aria-valuenow'));
  expect(dragged).toBeGreaterThan(280); expect(dragged).toBeLessThan(320);
  await page.reload();
  await expect(page.getByRole('separator', { name: '메일 목록 폭' })).toHaveAttribute('aria-valuenow', String(dragged));
  await page.getByRole('separator', { name: '메일 목록 폭' }).dblclick(); // 두 번 누르면 처음 폭
  await expect(page.getByRole('separator', { name: '메일 목록 폭' })).toHaveAttribute('aria-valuenow', '340');
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.getByRole('separator', { name: '메일 목록 폭' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
