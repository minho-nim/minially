import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { CODE_D } from '../playwright.config';
import { login } from './helpers';
import { csvCell } from '../src/csvExport';

const kstDay = (n = 0) => new Date(Date.now() + 9 * 3600000 + n * 86400000).toISOString().slice(0, 10);

test('CSV 칸: 수식 막기·쉼표·따옴표', () => {
  expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  expect(csvCell('-10')).toBe("'-10");
  expect(csvCell(-10)).toBe('-10'); // 숫자 칸은 그대로
  expect(csvCell('빵집, 성수')).toBe('"빵집, 성수"');
  expect(csvCell(null)).toBe('');
});

test('수익 목표: 정하기 → 받은·받을 금액 대비 → 새로고침 유지 → 지우기, 협찬 CSV 받기', async ({ page }) => {
  await login(page, CODE_D);
  await page.evaluate(async today => {
    const send = (body: unknown) => fetch('/api/campaigns', { method: 'POST', body: JSON.stringify(body) });
    await send({ kind: 'sponsor', brand: '목표빵집', amount: 150000, status: 'paid', paid_on: today });
    await send({ kind: 'sponsor', brand: '=수식카페', title: '신메뉴, 겨울', amount: 50000, status: 'in_progress' });
  }, kstDay());
  await page.goto('/#dashboard');
  await page.getByRole('button', { name: /수익 목표 정하기/ }).click();
  await page.getByLabel('한 달 목표(원)').fill('500');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('1,000원 이상');
  await page.getByLabel('한 달 목표(원)').fill('300,000');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const goal = page.locator('.goal');
  await expect(goal).toContainText('목표 50%');
  await expect(goal).toContainText('150,000원 남았어요 · 받을 금액까지 더하면 67%');
  await page.reload();
  await expect(page.locator('.goal')).toContainText('목표 50%');
  await page.locator('.goal').getByRole('button', { name: '바꾸기' }).click();
  await page.getByRole('button', { name: '목표 지우기' }).click();
  await expect(page.getByRole('button', { name: /수익 목표 정하기/ })).toBeVisible();

  await page.goto('/#campaigns');
  await page.getByRole('tab', { name: '전체' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV로 받기' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^minilog_campaigns_\d{8}\.csv$/);
  const text = await readFile((await download.path())!, 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text).toContain('종류,업체,캠페인,상태,금액(원)');
  expect(text).toContain(`협찬,목표빵집,,정산 완료,150000,,${kstDay()}`);
  expect(text).toContain(`협찬,'=수식카페,"신메뉴, 겨울",진행 중,50000`);
  await page.evaluate(async () => { for (const c of (await (await fetch('/api/campaigns')).json()).campaigns) await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' }); });
  expect(await page.evaluate(async () => (await fetch('/api/goal', { method: 'PUT', body: JSON.stringify({ monthly: 'x' }) })).status)).toBe(400);
});
