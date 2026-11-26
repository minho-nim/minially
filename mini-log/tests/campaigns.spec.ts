import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';

const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + 9 * 3600000 + n * 86400000).toISOString().slice(0, 10);

test('협찬을 적고 정산 완료하면 이번 달 수익·대시보드에 모이고, 광고 수익도 적을 수 있다', async ({ page }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '협찬', exact: true }).click();
  await expect(page.getByText('진행 중인 협찬이 없어요')).toBeVisible();

  await page.getByRole('button', { name: '새 협찬' }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('alert')).toHaveText('업체 이름을 적어 주세요.');
  await page.getByLabel('업체').fill('동네빵집');
  await page.getByLabel('캠페인 이름(선택)').fill('소금빵 체험단');
  await page.getByLabel('금액(원)').fill('십만');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('alert')).toHaveText('금액은 숫자로 적어 주세요.');
  await page.getByLabel('금액(원)').fill('100,000');
  await page.getByLabel('마감일(선택)').fill(plusDays(3));
  await page.getByLabel('제공 내용(선택)').fill('2인 식사권');
  await page.getByRole('button', { name: '저장' }).click();
  const row = page.locator('.campaign').filter({ hasText: '동네빵집' });
  await expect(row).toContainText('D-3');
  await expect(row).toContainText('100,000원');
  await expect(page.locator('.kpi').filter({ hasText: '받을 금액' }).locator('.value')).toHaveText('100,000원');

  // 정산 완료 → 진행 중 목록에서 빠지고 이번 달 받은 금액에 들어감
  await row.click();
  await page.getByLabel('상태').selectOption('paid');
  await expect(page.getByLabel('받은 날')).toHaveValue(kstToday());
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.locator('.campaign').filter({ hasText: '동네빵집' })).toHaveCount(0);
  await page.getByRole('tab', { name: '정산 완료' }).click();
  await expect(page.locator('.campaign').filter({ hasText: '동네빵집' })).toContainText('정산 완료');

  // 광고 수익: 업체 없이 금액만
  { const t = page.getByRole('button', { name: '협찬 메뉴' }); if (await t.getAttribute('aria-expanded') !== 'true') await t.click(); } // 화면 정리로 메뉴·접기 안에 들어가 먼저 연다
  await page.getByRole('button', { name: '광고 수익 적기' }).click();
  await page.getByLabel('금액(원)').fill('23500');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.locator('.campaign').filter({ hasText: '광고 수익' })).toContainText('23,500원');
  await expect(page.locator('.kpi').filter({ hasText: '받은 금액' }).locator('.value')).toHaveText('123,500원');

  // 새로고침해도 남고, 대시보드 수익 칸에 합계
  await page.reload();
  await page.getByRole('button', { name: '대시보드', exact: true }).click();
  await expect(page.locator('.revenue-now')).toHaveText('123,500원');
  await page.getByRole('button', { name: '협찬·수익 기록 보기' }).click();
  await expect(page.getByRole('heading', { name: '협찬·수익' })).toBeVisible();

  // 정리(다른 시험에 영향 없게)
  await page.evaluate(async () => {
    for (const c of (await (await fetch('/api/campaigns')).json()).campaigns) await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' });
  });
});

test('협찬 기록은 본인만 보고 고칠 수 있고, 잘못된 값은 거절한다', async ({ browser }) => {
  const c = await browser.newPage();
  await login(c, CODE_C);
  const made = await c.evaluate(async () => {
    const post = (body: unknown) => fetch('/api/campaigns', { method: 'POST', body: JSON.stringify(body) });
    const ok = await (await post({ brand: '비밀 업체', amount: 500000, deadline: '2026-12-01' })).json();
    return {
      id: ok.campaign.id as string,
      badDate: (await post({ brand: 'x', deadline: '2026-02-30' })).status,
      badAmount: (await post({ brand: 'x', amount: -1 })).status,
      badStatus: (await post({ brand: 'x', status: 'hacked' })).status,
      otherDraft: (await post({ brand: 'x', draft_id: '00000000-0000-0000-0000-000000000000' })).status,
    };
  });
  expect([made.badDate, made.badAmount, made.badStatus, made.otherDraft]).toEqual([400, 400, 400, 400]);
  const d = await browser.newPage();
  await login(d, CODE_D);
  const seen = await d.evaluate(async id => ({
    list: (await (await fetch('/api/campaigns')).json()).campaigns.length,
    put: (await fetch(`/api/campaigns/${id}`, { method: 'PUT', body: JSON.stringify({ amount: 1 }) })).status,
    del: (await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })).status,
    dash: (await (await fetch('/api/dashboard')).json()).revenue.pending.total,
  }), made.id);
  expect(seen).toEqual({ list: 0, put: 404, del: 404, dash: 0 });
  await c.evaluate(async id => { await fetch(`/api/campaigns/${id}`, { method: 'DELETE' }); }, made.id);
});
