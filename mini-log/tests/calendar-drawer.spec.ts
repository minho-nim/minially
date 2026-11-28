import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login, useMonthView } from './helpers';

const kst = (days = 0) => new Date(Date.now() + 9 * 3600000 + days * 86400000).toISOString().slice(0, 10);

test('격자의 빈 게시일: 게시 예정과 함께 날짜순(늦은 날이 왼쪽 위)', async () => {
  const { gridTiles } = await import('../src/InstaGrid');
  const d = (id: string, planned_on: string) => ({ id, title: id, status: 'draft' as const, planned_on, published_at: null });
  const tiles = gridTiles([d('a', '2026-12-02'), d('b', '2026-12-09')], '2026-11-30', 12, ['2026-12-04']);
  expect(tiles.map(t => `${t.kind}:${t.date}`)).toEqual(['planned:2026-12-09', 'empty:2026-12-04', 'planned:2026-12-02']);
});

test('캘린더 서랍: 날짜 없는 원고를 버튼이나 끌어 놓기로 날짜에 잡고, 격자에 빈 게시일이 보인다', async ({ page }) => {
  await login(page, CODE_C);
  await useMonthView(page);
  await page.evaluate(async () => {
    for (const t of ['서랍 원고 하나', '서랍 원고 둘']) {
      const d = (await (await fetch('/api/drafts', { method: 'POST', body: JSON.stringify({}) })).json()).draft;
      await fetch(`/api/drafts/${d.id}`, { method: 'PUT', body: JSON.stringify({ title: t }) });
    }
    await fetch('/api/plan', { method: 'PUT', body: JSON.stringify({ days: [0, 1, 2, 3, 4, 5, 6] }) });
  });
  await page.reload();
  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  const drawer = page.getByRole('list', { name: '날짜 없는 원고' });
  await expect(drawer.getByRole('listitem')).toHaveCount(2);

  // 1) 날짜를 고르고 버튼으로
  const target = kst(3);
  const short = `${Number(target.slice(5, 7))}/${Number(target.slice(8))}`;
  await page.getByRole('gridcell', { name: new RegExp(`^${Number(target.slice(5, 7))}월 ${Number(target.slice(8))}일,`) }).click();
  await drawer.getByRole('button', { name: `'서랍 원고 하나' ${short}로 잡기` }).click();
  await expect(page.getByRole('status').filter({ hasText: '서랍 원고 하나' })).toContainText('잡았어요');
  await expect(drawer.getByRole('listitem')).toHaveCount(1);

  // 2) 끌어 놓기
  const target2 = kst(5);
  const cell2 = page.getByRole('gridcell', { name: new RegExp(`^${Number(target2.slice(5, 7))}월 ${Number(target2.slice(8))}일,`) });
  await drawer.getByRole('listitem').filter({ hasText: '서랍 원고 둘' }).dragTo(cell2);
  await expect(page.getByText('모든 원고에 게시일이 있어요.')).toBeVisible();
  const planned = await page.evaluate(async () => Object.fromEntries((await (await fetch('/api/drafts')).json()).drafts.map((d: { title: string; planned_on: string }) => [d.title, d.planned_on])));
  expect(planned).toMatchObject({ '서랍 원고 하나': target, '서랍 원고 둘': target2 });

  // 격자: 매일 게시하는 요일이라 2주 안의 빈 날이 빗금 칸으로 보인다
  await expect(page.getByRole('list', { name: '인스타 프로필 격자' }).getByRole('img', { name: /빈 게시일$/ }).first()).toBeVisible();

  await page.evaluate(async () => { for (const d of (await (await fetch('/api/drafts')).json()).drafts) await fetch(`/api/drafts/${d.id}`, { method: 'DELETE' }); });
});
