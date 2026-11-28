import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login, useMonthView } from './helpers';

const kst = (days = 0) => new Date(Date.now() + 9 * 3600000 + days * 86400000).toISOString().slice(0, 10);

test('캘린더에 게시 예정·협찬 마감이 보이고, 날짜를 골라 원고를 만들 수 있다', async ({ page }) => {
  await login(page, CODE_C);
  await useMonthView(page);
  const target = kst(2);
  // 협찬 마감(같은 날)
  await page.evaluate(async d => { await fetch('/api/campaigns', { method: 'POST', body: JSON.stringify({ brand: '캘린더카페', deadline: d }) }); }, target);
  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  await expect(page.getByRole('heading', { name: '캘린더' })).toBeVisible();

  const cell = page.getByRole('gridcell', { name: new RegExp(`^${Number(target.slice(5, 7))}월 ${Number(target.slice(8))}일,`) });
  await cell.click();
  await expect(page.locator('.cal-list')).toContainText('캘린더카페');
  await page.getByRole('button', { name: '이 날 게시할 원고 만들기' }).click();
  await expect(page.getByLabel('게시 예정일(캘린더에 표시)')).toHaveValue(target);
  await page.getByLabel('제목').fill('캘린더 시험 원고');
  await expect(page.getByText('저장됨')).toBeVisible();

  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  await cell.click();
  await expect(page.locator('.cal-list')).toContainText('캘린더 시험 원고');
  await expect(cell).toHaveAccessibleName(/일정 2개/);
  await page.locator('.cal-list li', { hasText: '캘린더 시험 원고' }).getByRole('button', { name: '원고 열기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('캘린더 시험 원고');

  // 예정일을 지우면 캘린더에서 빠짐
  await page.getByLabel('게시 예정일(캘린더에 표시)').fill('');
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  await cell.click();
  await expect(page.locator('.cal-list')).not.toContainText('캘린더 시험 원고');

  // 잘못된 날짜는 거절
  expect(await page.evaluate(async () => (await fetch('/api/drafts', { method: 'POST', body: JSON.stringify({ planned_on: '2026-13-01' }) })).status)).toBe(400);

  await page.evaluate(async () => {
    for (const d of (await (await fetch('/api/drafts')).json()).drafts) await fetch(`/api/drafts/${d.id}`, { method: 'DELETE' });
    for (const c of (await (await fetch('/api/campaigns')).json()).campaigns) await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' });
  });
});

test('캘린더는 본인 원고·협찬만 보인다', async ({ browser }) => {
  const c = await browser.newPage();
  await login(c, CODE_C);
  await useMonthView(c);
  await c.evaluate(async d => { await fetch('/api/drafts', { method: 'POST', body: JSON.stringify({ planned_on: d }) }); }, kst(1));
  const d = await browser.newPage();
  await login(d, CODE_D);
  await useMonthView(d);
  await d.getByRole('button', { name: '캘린더', exact: true }).click();
  await expect(d.locator('.cal-chip')).toHaveCount(0);
  await c.evaluate(async () => { for (const x of (await (await fetch('/api/drafts')).json()).drafts) await fetch(`/api/drafts/${x.id}`, { method: 'DELETE' }); });
});
