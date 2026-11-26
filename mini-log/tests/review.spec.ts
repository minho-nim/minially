import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';

test('돌아보기 규칙: 평소 대비 배수(5편 이상), 평가·메모 검사', async () => {
  const { viewRatio, readReview } = await import('../functions/_review');
  expect(viewRatio(300, [100, 100, 100, 100])).toBeNull(); // 비교할 글이 5편 안 됨
  expect(viewRatio(300, [100, 100, 100, 200, 50])).toBe(3);
  expect(viewRatio(null, [1, 2, 3, 4, 5])).toBeNull();
  const id = '11111111-2222-3333-4444-555555555555';
  expect(readReview({ draft_id: id, verdict: 'good', note: ' 제목에 지역 이름 \r\n' })).toEqual({ draft_id: id, verdict: 'good', note: '제목에 지역 이름' });
  for (const bad of [null, { draft_id: 'x', verdict: 'good' }, { draft_id: id, verdict: 'great' }, { draft_id: id, verdict: 'ok', note: 3 }, { draft_id: id, verdict: 'low', note: '가'.repeat(301) }])
    expect(typeof readReview(bad)).toBe('string');
});

test('게시 7일 뒤 돌아보기: 7일 지난 글만 보이고, 평가를 남기면 최근 돌아본 글로 옮긴다', async ({ page, request }) => {
  for (const r of [await request.get('/api/reviews'), await request.post('/api/reviews', { data: {} })]) expect(r.status()).toBe(401);
  await login(page, CODE_C);
  const day = 86400000;
  const ids = { old: 'aaaaaaaa-0000-4000-8000-000000000001', fresh: 'aaaaaaaa-0000-4000-8000-000000000002' };
  const draft = (id: string, title: string, at: number) => ({ id, title, body: '', hashtags: [], experience: '', status: 'published', published_url: 'https://blog.naver.com/me/1', published_at: at, style_id: 'mine', planned_on: null, created_at: at, updated_at: at });
  const now = Date.now();
  const restored = await page.evaluate(async backup => (await fetch('/api/backup', { method: 'POST', body: JSON.stringify(backup) })).status, {
    app: 'mini-log', version: (await page.evaluate(async () => (await (await fetch('/api/backup')).json()).version)),
    drafts: [draft(ids.old, '8일 전 올린 글', now - 8 * day), draft(ids.fresh, '어제 올린 글', now - day)], campaigns: [], styles: [], blogs: [], posts: [], watch: [], proposal: null,
  });
  expect(restored).toBe(200);

  // 아직 7일이 안 된 글은 저장할 수 없다
  const tooSoon = await page.evaluate(async id => (await fetch('/api/reviews', { method: 'POST', body: JSON.stringify({ draft_id: id, verdict: 'good' }) })).json(), ids.fresh);
  expect(tooSoon.error).toContain('7일');

  await page.getByRole('button', { name: '대시보드', exact: true }).click();
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: /게시 7일 뒤 돌아보기/ }) });
  await expect(card).toContainText('8일 전 올린 글');
  await expect(card).not.toContainText('어제 올린 글');
  await expect(card).toContainText('조회수가 아직 없어요');
  const save = card.getByRole('button', { name: '돌아보기 저장' });
  await expect(save).toBeDisabled();
  await card.getByRole('group', { name: '8일 전 올린 글 평가' }).getByRole('button', { name: '아쉬움' }).click();
  await card.getByLabel('8일 전 올린 글 메모').fill('제목에 지역 이름을 넣자');
  await save.click();
  await expect(card.getByRole('list', { name: '최근 돌아본 글' })).toContainText('제목에 지역 이름을 넣자');
  await expect(card).toContainText('돌아볼 글 0개');

  // 다른 사람은 내 원고를 평가할 수 없다
  const other = await page.context().browser()!.newPage();
  await login(other, CODE_D);
  expect(await other.evaluate(async id => (await fetch('/api/reviews', { method: 'POST', body: JSON.stringify({ draft_id: id, verdict: 'good' }) })).status, ids.old)).toBe(400);
  expect((await other.evaluate(async () => (await (await fetch('/api/reviews')).json()).recent)).length).toBe(0);
  await other.close();

  await page.evaluate(async list => { for (const id of list) await fetch(`/api/drafts/${id}`, { method: 'DELETE' }); }, [ids.old, ids.fresh]);
  expect((await page.evaluate(async () => (await (await fetch('/api/reviews')).json()).recent)).length).toBe(0);
});
