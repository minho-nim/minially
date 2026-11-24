import { expect, test } from '@playwright/test';
import { CODE_D } from '../playwright.config';
import { login } from './helpers';

const kstDay = (n = 0) => new Date(Date.now() + 9 * 3600000 + n * 86400000).toISOString().slice(0, 10);

test('제안 보낸 걸로 기록 → 협찬에 답장 기다림 → 답장 바꾸면 상태도, 업체별로 모아 보기', async ({ page }) => {
  await login(page, CODE_D);
  await page.goto('/#proposal');
  await page.getByLabel('업체 이름').fill('답장시험카페');
  await page.getByLabel('왜 이 업체인가요?').fill('동네 단골이에요');
  await page.getByRole('button', { name: '보낸 걸로 기록' }).click();
  await expect(page.getByRole('status').filter({ hasText: '답장시험카페 제안함' })).toBeVisible();
  await expect(page.getByRole('button', { name: '기록함 ✓' })).toBeDisabled();
  // 같은 업체를 다시 기록하면 새로 만들지 않고 고친다
  await page.getByRole('tablist', { name: '보낼 곳' }).getByRole('tab', { name: '인스타 DM' }).click();
  await page.getByRole('button', { name: '보낸 걸로 기록' }).click();
  await expect(page.getByRole('button', { name: '기록함 ✓' })).toBeVisible();
  const list = await page.evaluate(async () => (await (await fetch('/api/campaigns')).json()).campaigns.filter((c: { brand: string }) => c.brand === '답장시험카페'));
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ status: 'proposed', memo: '동네 단골이에요', pitch: { via: 'dm', reply: 'waiting' } });

  await page.goto('/#campaigns');
  const row = page.locator('.campaign').filter({ hasText: '답장시험카페' });
  await expect(row).toContainText('DM 제안 · 0일째 답장 기다림');
  // 7일이 지나도 답장이 없으면 다시 연락을 권한다
  await page.evaluate(async ({ id, on }) => { await fetch(`/api/campaigns/${id}`, { method: 'PUT', body: JSON.stringify({ pitch: { on, via: 'mail', reply: 'waiting' } }) }); }, { id: list[0].id, on: kstDay(-8) });
  await page.reload();
  await expect(row).toContainText('8일째 답장 없음, 다시 연락해 볼까요?');
  // 답장 '좋다고 함' → 진행 중
  await row.click();
  await page.locator('#c-reply').selectOption('yes');
  await expect(page.getByLabel('상태')).toHaveValue('in_progress');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(row).toContainText('진행 중');
  // 업체별 보기
  await page.getByRole('tab', { name: '업체별' }).click();
  await expect(page.getByRole('list', { name: '업체별' })).toContainText('답장시험카페');
  await expect(page.getByRole('list', { name: '업체별' })).toContainText('1건 · 진행 중 1');
  // 잘못된 기록은 거절
  expect(await page.evaluate(async id => (await fetch(`/api/campaigns/${id}`, { method: 'PUT', body: JSON.stringify({ pitch: { on: '2026-13-01', via: 'mail' } }) })).status, list[0].id)).toBe(400);
  await page.evaluate(async () => { for (const c of (await (await fetch('/api/campaigns')).json()).campaigns) await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' }); });
});
