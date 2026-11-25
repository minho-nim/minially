import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login } from './helpers';

test('원고가 200개를 넘으면 목록 끝에 이전 원고 더 보기가 나오고, 누르면 나머지가 이어 붙는다', async ({ page }) => {
  await login(page, CODE_C);
  const made = await page.evaluate(async () => {
    const ids: string[] = [];
    for (let i = 0; i < 205; i += 15) {
      const batch = await Promise.all(Array.from({ length: Math.min(15, 205 - i) }, (_, k) => fetch('/api/drafts', { method: 'POST', body: JSON.stringify({ title: `쌓인 원고 ${String(i + k).padStart(3, '0')}` }) }).then(r => r.json())));
      ids.push(...batch.map(b => b.draft.id));
    }
    return ids;
  });
  try {
    await page.reload();
    const list = page.getByRole('navigation', { name: '원고' });
    await expect(list.getByRole('button')).toHaveCount(200);
    const more = page.getByRole('button', { name: '이전 원고 더 보기' });
    await expect(more).toBeVisible();
    await more.click();
    // 누르면 '불러오는 중…'으로 바뀌므로, 버튼이 사라진 것만 보지 말고 목록이 늘어날 때까지 기다린다
    await expect.poll(() => list.getByRole('button').count()).toBeGreaterThanOrEqual(205);
    await expect(page.getByRole('button', { name: /이전 원고 더 보기|불러오는 중/ })).toHaveCount(0);
    await expect(list.getByRole('button', { name: /쌓인 원고 000/ })).toHaveCount(1);
    expect(await page.evaluate(async () => (await fetch('/api/drafts?before=abc')).status)).toBe(400);
  } finally {
    await page.evaluate(async (ids) => { for (let i = 0; i < ids.length; i += 20) await Promise.all(ids.slice(i, i + 20).map(id => fetch(`/api/drafts/${id}`, { method: 'DELETE' }))); }, made);
  }
});
