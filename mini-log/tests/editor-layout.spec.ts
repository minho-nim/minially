import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login } from './helpers';

test('원고 편집 2단: 넓은 화면은 옆 칸(점검·미리보기·올리기)과 집중, 휴대폰은 아래 바로가기 막대', async ({ page }) => {
  await login(page, CODE_C);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel('제목').fill('2단 화면 시험');
  const side = page.getByRole('complementary', { name: '점검·미리보기·올리기' });
  await expect(side).toBeVisible();
  // 쓰는 칸과 옆 칸이 나란히(옆 칸이 오른쪽)
  const [w, s] = [await page.getByLabel('제목').boundingBox(), await side.boundingBox()];
  expect(s!.x).toBeGreaterThan(w!.x + w!.width);
  await expect(side.getByRole('heading', { name: /올리기·게시/ })).toBeAttached();
  // 바로가기: '올리기'를 누르면 옆 칸 안에서 올리기 칸이 보인다
  await side.getByRole('navigation', { name: '옆 칸 바로가기' }).getByRole('button', { name: '올리기' }).click();
  await expect(page.getByLabel('게시 예정일(캘린더에 표시)')).toBeInViewport();
  // 집중: 옆 칸을 접고, 새로고침해도 기억, 다시 누르면 펼침
  await page.getByRole('button', { name: '집중', exact: true }).click();
  await expect(side).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: '집중 끝' })).toHaveAttribute('aria-pressed', 'true');
  await expect(side).toBeHidden();
  await page.getByRole('button', { name: '집중 끝' }).click();
  await expect(side).toBeVisible();

  // 휴대폰: 한 줄로, 아래 막대로 오간다(집중 버튼은 숨김)
  await page.setViewportSize({ width: 390, height: 844 });
  const bar = page.getByRole('navigation', { name: '원고 화면 바로가기' });
  await expect(bar).toBeVisible();
  await expect(page.getByRole('button', { name: '집중', exact: true })).toBeHidden();
  await bar.getByRole('button', { name: '올리기' }).click();
  await expect(page.getByLabel('게시 예정일(캘린더에 표시)')).toBeInViewport();
  await bar.getByRole('button', { name: '쓰기' }).click();
  await expect(page.getByRole('heading', { name: /사진/ }).first()).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  await page.evaluate(async () => { for (const d of (await (await fetch('/api/drafts')).json()).drafts) await fetch(`/api/drafts/${d.id}`, { method: 'DELETE' }); });
});
