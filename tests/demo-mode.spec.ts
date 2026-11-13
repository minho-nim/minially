import { test, expect } from '@playwright/test';

// 코드 없이 체험하기: 로그인 우회(minially-sync-skip) 없이 실제 로그인 화면에서 시작한다.
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('로그인 화면에서 체험을 시작하면 예시 데이터가 보이고, 서버에 요청하지 않으며, 끝내면 지워진다', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', r => { if (r.url().includes('/api/')) apiCalls.push(r.url()); });
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: '코드 없이 체험하기' }).click();
  await expect(page.getByText('체험 모드', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-calendar-date]').first()).toBeVisible();
  await expect(page.getByText('친구', { exact: false }).first()).toBeVisible();

  // 새로고침해도 체험이 이어진다
  await page.reload();
  await expect(page.getByText('체험 모드', { exact: true })).toBeVisible({ timeout: 15000 });

  // 설정: 공유는 막히고 체험 끝내기 단추가 있다
  await page.getByRole('button', { name: '설정', exact: true }).first().click();
  const settings = page.getByRole('dialog', { name: '설정' });
  await expect(settings.getByRole('button', { name: '체험 끝내기', exact: true })).toBeVisible();
  await settings.getByRole('button', { name: '공유' }).click();
  await expect(settings.getByText('체험 모드에서는 일정 공유')).toBeVisible();
  await settings.getByRole('button', { name: '백업/복원' }).click();
  await expect(settings.getByRole('button', { name: '체험 끝내고 로그인하기' })).toBeVisible();

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '체험 끝내기', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '코드 없이 체험하기' })).toBeVisible({ timeout: 15000 });
  const left = await page.evaluate(() => new Promise<number>(resolve => {
    const req = indexedDB.open('DayFlowDB');
    req.onsuccess = () => { const tx = req.result.transaction('schedules'); const c = tx.objectStore('schedules').count(); c.onsuccess = () => resolve(c.result); };
  }));
  expect(left).toBe(0);
  expect(apiCalls).toEqual([]);
});
