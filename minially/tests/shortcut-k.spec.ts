import { expect, test } from '@playwright/test';
// 세 앱 같은 빠른 찾기 키: Ctrl K(맥 ⌘K)로 일정 검색이 열리고, 메모 화면에서는 메모 검색이 열린다
test('Ctrl K로 일정 검색을 열고, 메모 화면에서는 메모 검색으로 간다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).first().waitFor();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: '일정 검색' })).toBeVisible();
  await page.getByRole('button', { name: '일정 검색 닫기' }).click();
  await page.getByRole('button', { name: '메모', exact: true }).filter({ visible: true }).click();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('searchbox', { name: '메모 검색', exact: true })).toBeVisible();
});
