import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login, pngBytes, useMonthView } from './helpers';

const kst = (days = 0) => new Date(Date.now() + 9 * 3600000 + days * 86400000).toISOString().slice(0, 10);

test('격자 순서: 늦은 게시 예정이 왼쪽 위, 그다음 최근 게시한 원고, 지난 예정일은 뺀다', async () => {
  const { gridTiles } = await import('../src/InstaGrid');
  const d = (id: string, status: 'draft' | 'published', planned_on: string | null, published_at: number | null = null) => ({ id, title: id, status, planned_on, published_at });
  const tiles = gridTiles([
    d('a', 'draft', '2026-12-01'), d('b', 'draft', '2026-12-05'), d('old', 'draft', '2026-11-01'),
    d('p1', 'published', null, Date.UTC(2026, 10, 20)), d('p2', 'published', null, Date.UTC(2026, 10, 25)), d('none', 'draft', null),
  ], '2026-11-26');
  expect(tiles.map(t => t.id)).toEqual(['b', 'a', 'p2', 'p1']);
  expect(tiles[2]).toMatchObject({ kind: 'published', date: '2026-11-25' });
  expect(gridTiles(Array.from({ length: 20 }, (_, i) => d(`x${i}`, 'draft', kst(i + 1))), kst()).length).toBe(12);
});

test('인스타 격자: 첫 사진이 표지로 보이고, 두 칸을 누르면 게시일을 맞바꾼다', async ({ page }) => {
  await login(page, CODE_C);
  await useMonthView(page);
  const made = await page.evaluate(async ([first, second, png]) => {
    const one = (await (await fetch('/api/drafts', { method: 'POST', body: JSON.stringify({ planned_on: first }) })).json()).draft;
    await fetch(`/api/drafts/${one.id}`, { method: 'PUT', body: JSON.stringify({ title: '격자 첫 원고' }) });
    const two = (await (await fetch('/api/drafts', { method: 'POST', body: JSON.stringify({ planned_on: second }) })).json()).draft;
    await fetch(`/api/drafts/${two.id}`, { method: 'PUT', body: JSON.stringify({ title: '격자 둘째 원고' }) });
    const photo = (await (await fetch(`/api/drafts/${two.id}/photos`, { method: 'POST', body: new Uint8Array(png as number[]) })).json()).photo?.id ?? null;
    return { one: one.id as string, two: two.id as string, photo: photo as string | null };
  }, [kst(3), kst(5), [...pngBytes(8, 10, [200, 60, 90])]] as const);

  // 표지 API: 본인 원고만, 잘못된 목록은 400
  const covers = await page.evaluate(async ids => ({
    ok: await (await fetch(`/api/photos/covers?ids=${ids.join(',')}`)).json(),
    bad: (await fetch('/api/photos/covers?ids=nope')).status,
  }), [made.one, made.two]);
  expect(covers.bad).toBe(400);
  expect(made.photo).toBeTruthy();
  expect(covers.ok.covers).toEqual({ [made.two]: made.photo });

  await page.reload();
  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  const grid = page.getByRole('list', { name: '인스타 프로필 격자' });
  const tiles = grid.getByRole('button');
  await expect(tiles).toHaveCount(2);
  await expect(tiles.nth(0)).toHaveAccessibleName(/^격자 둘째 원고, .* 게시 예정$/); // 늦은 날짜가 왼쪽 위
  await expect(tiles.nth(0).locator('img')).toHaveAttribute('src', `/api/photos/${made.photo}`);
  await expect(tiles.nth(1).locator('.grid-title')).toHaveText('격자 첫 원고');

  await tiles.nth(0).click();
  await expect(tiles.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await tiles.nth(1).click();
  await expect(page.getByRole('status').filter({ hasText: '로 바꿨어요' })).toBeVisible();
  const after = await page.evaluate(async () => Object.fromEntries((await (await fetch('/api/drafts')).json()).drafts.map((d: { title: string; planned_on: string }) => [d.title, d.planned_on])));
  expect(after['격자 첫 원고']).toBe(kst(5));
  expect(after['격자 둘째 원고']).toBe(kst(3));
  await expect(tiles.nth(0)).toHaveAccessibleName(/^격자 첫 원고/);

  // 다른 사람은 내 표지를 못 본다
  const other = await page.context().browser()!.newPage();
  await login(other, CODE_D);
  await useMonthView(other);
  expect(await other.evaluate(async ids => (await (await fetch(`/api/photos/covers?ids=${ids.join(',')}`)).json()).covers, [made.one, made.two])).toEqual({});
  await other.close();

  await page.evaluate(async () => { for (const d of (await (await fetch('/api/drafts')).json()).drafts) await fetch(`/api/drafts/${d.id}`, { method: 'DELETE' }); });
});
