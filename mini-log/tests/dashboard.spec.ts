import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login, pngBytes } from './helpers';

test('내 대시보드에 원고·AI·사진·삭제 예정이 본인 것만 보인다', async ({ page, browser }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: pngBytes(20, 20, [200, 100, 50]) });
  await expect(page.getByText('1/20장')).toBeVisible();
  await page.getByLabel(/직접 겪은 내용/).fill('대시보드 시험용 경험 글입니다. 충분히 길게.');
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue(/가짜 Gemini/);
  await page.getByLabel('게시한 글 주소').fill('https://blog.naver.com/test/dash');
  await page.getByRole('button', { name: '게시 완료' }).click();
  await expect(page.locator('.badge')).toHaveText('게시됨');

  await page.getByRole('button', { name: '대시보드' }).click();
  await expect(page.getByRole('heading', { name: '내 대시보드' })).toBeVisible();
  const kpi = (label: RegExp) => page.locator('.kpi').filter({ hasText: label }).locator('.value');
  expect(Number(await kpi(/게시한 글/).innerText())).toBeGreaterThanOrEqual(1);
  expect(Number((await kpi(/AI 호출/).innerText()).replace(/,/g, ''))).toBeGreaterThanOrEqual(1);
  await expect(page.getByText(/사진 보고 초안/)).toBeVisible();
  // 그래프: 원고 현황 도넛, 최근 6개월 게시 글 막대(이번 달 1개 이상), AI 작업별 막대
  await expect(page.getByRole('img', { name: /^원고 현황: 작성 중 \d+, 승인됨 \d+, 게시됨 [1-9]/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /^월별 게시 글: (\d+월 \d+개, ){5}\d+월 [1-9]\d*개$/ })).toBeVisible();
  await expect(page.getByRole('list', { name: 'AI 작업별 호출' })).toContainText('사진 보고 초안');
  await expect(page.locator('.expiring')).toContainText('사진 1장');
  await page.locator('.expiring .link-button').first().click();
  await expect(page.getByLabel('제목')).toBeVisible(); // 삭제 예정 원고로 바로 이동

  const d = await browser.newPage();
  await login(d, CODE_D);
  const other = await d.evaluate(async () => (await fetch('/api/dashboard')).json());
  expect(other.drafts.published).toBe(0);
  expect(other.photos.count).toBe(0);
  expect(other.ai.calls).toBe(0);
  expect(JSON.stringify(other)).not.toContain('dash');

  // 다른 시험에 영향이 없도록 이 시험이 만든 원고(사진 포함)를 지운다.
  await page.evaluate(async () => {
    for (const draft of (await (await fetch('/api/drafts')).json()).drafts) await fetch(`/api/drafts/${draft.id}`, { method: 'DELETE' });
  });
});
