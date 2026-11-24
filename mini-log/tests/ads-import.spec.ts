import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login } from './helpers';
import { parseAdCsv } from '../src/adsImport';

test('광고 수익 CSV 읽기: 한글·영어 머리글, 탭, 설명 줄·합계 줄, 날짜 모양', () => {
  const ko = '﻿애드센스 보고서\n기간: 2026-10-01 ~ 2026-11-30\n날짜,페이지 조회수,"예상 수입(KRW)"\n2026-10-30,120,"₩1,200"\n2026. 10. 31.,80,800.4\n2026/11/01,50,"2,500"\n합계,,"4,500"\n';
  expect(parseAdCsv(ko)).toEqual({ months: [{ month: '2026-10', amount: 2000 }, { month: '2026-11', amount: 2500 }], rows: 3, skipped: 1 });
  const en = 'Month\tImpressions\tEstimated earnings (KRW)\n2026-09\t1000\t15,300\n2026-10\t900\t12,000\n';
  expect(parseAdCsv(en)).toEqual({ months: [{ month: '2026-09', amount: 15300 }, { month: '2026-10', amount: 12000 }], rows: 2, skipped: 0 });
  expect(parseAdCsv('이름,값\na,1')).toContain('찾지 못했어요');
  expect(parseAdCsv('날짜,수익\n합계,10')).toContain('없어요');
});

test('광고 수익 가져오기: 미리보기 → 기록 → 같은 달은 금액만 바뀜 → 월간 보고에 반영', async ({ page }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '협찬', exact: true }).click();
  await page.getByRole('button', { name: '광고 수익 가져오기' }).click();
  const csv = (amount: string) => ({ name: 'adsense.csv', mimeType: 'text/csv', buffer: Buffer.from(`날짜,예상 수입(KRW)\n2026-09-10,"${amount}"\n2026-09-20,1000\n2026-08-05,700\n`) });
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles(csv('2,000'));
  const preview = page.getByRole('table', { name: '가져올 광고 수익' });
  await expect(preview).toContainText('2026년 9월');
  await expect(preview).toContainText('3,000원');
  await page.getByRole('button', { name: '2달 기록하기' }).click();
  await expect(page.getByRole('status')).toContainText('애드센스 수익을 기록했어요(새로 2달, 바꿈 0달)');
  // 같은 파일(금액 수정) 다시 → 새로 만들지 않고 바꿈
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles(csv('4,000'));
  await page.getByRole('button', { name: '2달 기록하기' }).click();
  await expect(page.getByRole('status')).toContainText('(새로 0달, 바꿈 2달)');
  const result = await page.evaluate(async () => {
    const camps = (await (await fetch('/api/campaigns')).json()).campaigns.filter((c: { memo: string }) => c.memo.startsWith('import:adsense:'));
    const report = (await (await fetch('/api/report?month=2026-09')).json()).report;
    return { list: camps.map((c: { title: string; amount: number; paid_on: string; kind: string }) => `${c.kind}|${c.title}|${c.amount}|${c.paid_on}`).sort(), ad: report.summary.ad_revenue, ids: camps.map((c: { id: string }) => c.id) };
  });
  expect(result.list).toEqual(['ad|8월 애드센스 수익|700|2026-08-31', 'ad|9월 애드센스 수익|5000|2026-09-30']);
  expect(result.ad).toBe(5000);
  // 잘못된 값 400
  expect(await page.evaluate(async () => (await fetch('/api/campaigns/import-ads', { method: 'POST', body: JSON.stringify({ source: 'adsense', months: [{ month: '2026-13', amount: 1 }] }) })).status)).toBe(400);
  await page.evaluate(async ids => { for (const id of ids) await fetch(`/api/campaigns/${id}`, { method: 'DELETE' }); }, result.ids);
});
