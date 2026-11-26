import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { POST_TYPES } from '../functions/_postTypes';
import { TYPE_LABEL } from '../../shared/server/writing';
import { login } from './helpers';

test('미니허브와 같이 쓰는 글 종류 이름이 미니로그 이름과 같다', () => {
  for (const [key, t] of Object.entries(POST_TYPES)) if (key !== 'none') expect(TYPE_LABEL[key]).toBe(t.label);
  expect(Object.keys(TYPE_LABEL).length).toBe(Object.keys(POST_TYPES).length - 1);
});

test('글쓰기 설정은 계정 기반: 다른 기기에서도 글 구조가 같고, 자주 쓴 글 종류는 원고에서 센다', async ({ page, browser, request }) => {
  for (const r of [await request.get('/api/prefs'), await request.put('/api/prefs', { data: { structure: 'homefeed' } })]) expect(r.status()).toBe(401);
  await login(page, CODE_C);
  const made = await page.evaluate(async () => {
    const ids: string[] = [];
    for (const t of ['travel', 'travel', 'travel', 'beauty', 'beauty', 'none']) {
      const d = (await (await fetch('/api/drafts', { method: 'POST', body: '{}' })).json()).draft;
      await fetch(`/api/drafts/${d.id}`, { method: 'PUT', body: JSON.stringify({ post_type: t }) }); ids.push(d.id);
    }
    return { ids, bad: (await fetch('/api/prefs', { method: 'PUT', body: JSON.stringify({ structure: 'clickbait' }) })).status, prefs: await (await fetch('/api/prefs')).json() };
  });
  expect(made.bad).toBe(400);
  expect(made.prefs.type_usage.slice(0, 2)).toEqual([{ type: 'travel', label: '여행·나들이', count: 3 }, { type: 'beauty', label: '뷰티', count: 2 }]);

  // 원고 화면: 자주 쓴 글 종류(여행·뷰티)가 먼저 보인다
  await page.reload();
  await page.getByRole('button', { name: '새 원고' }).click();
  const types = page.getByRole('group', { name: '글 종류' }).getByRole('button');
  await expect(types.nth(0)).toHaveText('여행·나들이');
  await expect(types.nth(1)).toHaveText('뷰티');
  // 글 구조를 바꾸면 다른 기기(새 브라우저)에서도 같다
  await page.getByRole('button', { name: /자세히 설정/ }).click();
  await page.getByLabel('글 구조').selectOption('homefeed');
  await expect.poll(async () => (await page.evaluate(async () => (await (await fetch('/api/prefs')).json()).structure))).toBe('homefeed');
  const other = await (await browser.newContext()).newPage();
  await login(other, CODE_C);
  await other.getByRole('button', { name: '새 원고' }).click();
  await expect(other.getByText(/구조: 홈피드형 · 문체/)).toBeVisible();
  // 다른 사람(D)에게는 섞이지 않는다
  const d = await (await browser.newContext()).newPage();
  await login(d, CODE_D);
  expect(await d.evaluate(async () => (await (await fetch('/api/prefs')).json()))).toMatchObject({ structure: 'basic', type_usage: [] });

  await page.evaluate(async ids => {
    await fetch('/api/prefs', { method: 'PUT', body: JSON.stringify({ structure: 'basic' }) });
    for (const id of ids) await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
    for (const x of (await (await fetch('/api/drafts')).json()).drafts) await fetch(`/api/drafts/${x.id}`, { method: 'DELETE' });
  }, made.ids);
});
