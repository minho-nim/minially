import { expect, test } from '@playwright/test';

test('켤 때 3초 뒤 서버에 새 화면이 있으면 알리고, 닫은 버전은 다시 안 띄우며, 같으면 조용하다', async ({ page }) => {
  let commit = 'abc1234';
  await page.route('**/version.json*', route => route.fulfill({ json: { commit } }));
  await page.goto('/');
  const banner = page.getByRole('status', { name: '새 버전 알림' });
  await expect(banner).toBeVisible({ timeout: 8000 });
  await expect(banner.getByRole('button', { name: '새로고침' })).toBeVisible();
  await banner.getByRole('button', { name: '새 버전 알림 닫기' }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(3800);
  await expect(banner).toHaveCount(0); // 닫은 버전
  commit = (await (await page.request.get('/version.json')).json()).commit; // 지금 화면과 같은 커밋이면(같은 빌드)
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(3800);
  await expect(banner).toHaveCount(0);
});
