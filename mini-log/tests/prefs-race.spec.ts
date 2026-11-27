import { expect, test } from '@playwright/test';
// 느린 망에서 계정 설정(/api/prefs) 응답이 늦게 와도, 사람이 이미 고른 글 구조를 '기본'으로 되돌리지 않는다
import { CODE_C } from '../playwright.config';
import { login } from './helpers';
test('느린 설정 응답이 고른 구조를 덮어쓰지 않는다', async ({ page }) => {
  await login(page, CODE_C);
  await page.route('**/api/prefs', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const res = await route.fetch(); await new Promise(r => setTimeout(r, 1500)); await route.fulfill({ response: res });
  });
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByRole('button', { name: /자세히 설정/ }).click();
  await page.getByLabel('글 구조').selectOption('homefeed');
  await page.waitForTimeout(2000);
  await expect(page.getByLabel('글 구조')).toHaveValue('homefeed');
  await page.unroute('**/api/prefs');
  await page.evaluate(async () => { await fetch('/api/prefs', { method: 'PUT', body: JSON.stringify({ structure: 'basic' }) }); });
});
