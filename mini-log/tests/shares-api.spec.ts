import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';

test('올린 곳 기록 API: 내 원고만, 정해진 곳(인스타·스레드·X)만, 다른 사람은 못 봄', async ({ page, browser }) => {
  await login(page, CODE_C);
  const id = await page.evaluate(async () => (await (await fetch('/api/drafts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json()).draft.id);
  const put = (body: unknown) => page.evaluate(async ([id, body]) => { const r = await fetch(`/api/drafts/${id}/shares`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return r.status; }, [id, body] as const);
  expect(await put({ channel: 'facebook', shared: true })).toBe(400);
  expect(await put({ channel: 'x', shared: 'yes' })).toBe(400);
  expect(await put({ channel: 'x', shared: true })).toBe(200);
  const other = await browser.newPage();
  await login(other, CODE_D);
  expect(await other.evaluate(async id => (await fetch(`/api/drafts/${id}/shares`)).status, id)).toBe(404); // 남의 원고
  await other.close();
  await page.evaluate(async id => { await fetch(`/api/drafts/${id}`, { method: 'DELETE' }); }, id);
  expect(await page.evaluate(async id => (await fetch(`/api/drafts/${id}/shares`)).status, id)).toBe(404);
});
