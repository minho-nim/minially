import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';

test('백업에 돌아보기·담아 둔 글감·SNS 아이디·게시 요일도 들어가고, 다른 계정에는 빈 곳만 채운다', async ({ page, browser }) => {
  await login(page, CODE_C);
  const at = Date.now() - 9 * 86400000;
  const draftId = 'cccccccc-0000-4000-8000-000000000001';
  const version = await page.evaluate(async () => (await (await fetch('/api/backup')).json()).version);
  await page.evaluate(async ([v, id, t]) => {
    const s = (u: string, m: string, b: unknown) => fetch(u, { method: m, body: JSON.stringify(b) });
    await s('/api/backup', 'POST', { app: 'mini-log', version: v, campaigns: [], styles: [], blogs: [], posts: [], watch: [], proposal: null,
      drafts: [{ id, title: '백업 돌아보기 글', body: '', hashtags: [], experience: '', status: 'published', published_url: '', published_at: t, style_id: 'mine', planned_on: null, created_at: t, updated_at: t }] });
    await s('/api/reviews', 'POST', { draft_id: id, verdict: 'good', note: '사진 첫 장이 좋았다' });
    await s('/api/ideas/saved', 'POST', { text: '백업 글감 하나', memo: '메모' });
    await s('/api/accounts', 'PUT', { platform: 'threads', handle: '@backup.c' });
    await s('/api/plan', 'PUT', { days: [2, 4] });
  }, [version, draftId, at] as const);

  const backup = await page.evaluate(async () => (await fetch('/api/backup')).json());
  expect(backup.reviews).toEqual([expect.objectContaining({ draft_id: draftId, verdict: 'good', note: '사진 첫 장이 좋았다' })]);
  expect(backup.saved_ideas.map((i: { text: string }) => i.text)).toContain('백업 글감 하나');
  expect(backup.accounts).toContainEqual({ platform: 'threads', handle: 'backup.c' });
  expect(backup.rhythm).toEqual([2, 4]);

  // 같은 계정에 다시 합치면 그대로
  const again = await page.evaluate(async b => (await (await fetch('/api/backup', { method: 'POST', body: JSON.stringify(b) })).json()).result, backup);
  expect(again.reviews).toMatchObject({ added: 0, kept: 1 });
  expect(again.saved_ideas).toMatchObject({ added: 0, kept: 1 });
  expect(again.accounts).toMatchObject({ added: 0, kept: 1 });

  // 다른 사용자(D): 남의 원고 평가는 건너뛰고, 글감·빈 SNS 아이디는 더한다. 잘못된 값은 건너뛴다
  const d = await (await browser.newContext()).newPage();
  await login(d, CODE_D);
  const only = { app: 'mini-log', version, drafts: [], campaigns: [], styles: [], blogs: [], posts: [], watch: [], proposal: null,
    reviews: [...backup.reviews, { draft_id: 'x', verdict: 'great' }], saved_ideas: [...backup.saved_ideas, { text: '', url: 'javascript:1' }],
    accounts: [...backup.accounts, { platform: 'myspace', handle: 'a' }, { platform: 'x', handle: '너무 긴 아이디는 안 됨' }], rhythm: [2, 4] };
  const res = await d.evaluate(async b => (await (await fetch('/api/backup', { method: 'POST', body: JSON.stringify(b) })).json()).result, only);
  expect(res.reviews).toMatchObject({ added: 0, skipped: 2 });
  expect(res.saved_ideas).toMatchObject({ added: 1, skipped: 1 });
  expect(res.accounts).toMatchObject({ added: 1, skipped: 2 });
  const dSaved = await d.evaluate(async () => (await (await fetch('/api/ideas/saved')).json()).saved);
  expect(dSaved.map((i: { text: string }) => i.text)).toEqual(['백업 글감 하나']);
  expect(dSaved[0].id).not.toBe(backup.saved_ideas[0].id); // 남의 id는 쓰지 않는다
  expect((await d.evaluate(async () => (await (await fetch('/api/accounts')).json()))).handles).toContainEqual(expect.objectContaining({ platform: 'threads', handle: 'backup.c' }));

  // 정리
  await d.evaluate(async () => {
    for (const s of (await (await fetch('/api/ideas/saved')).json()).saved) await fetch(`/api/ideas/saved/${s.id}`, { method: 'DELETE' });
    await fetch('/api/accounts', { method: 'PUT', body: JSON.stringify({ platform: 'threads', handle: '' }) });
  });
  await page.evaluate(async id => {
    await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
    for (const s of (await (await fetch('/api/ideas/saved')).json()).saved) await fetch(`/api/ideas/saved/${s.id}`, { method: 'DELETE' });
    await fetch('/api/accounts', { method: 'PUT', body: JSON.stringify({ platform: 'threads', handle: '' }) });
  }, draftId);
});
