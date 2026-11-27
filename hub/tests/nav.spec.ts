import { expect, test, type Page } from '@playwright/test';
import { CODE_C } from '../playwright.config';

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('로그인 코드').fill(CODE_C);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.locator('.scope')).toBeVisible();
}

test('넓은 화면 메뉴: 보기·관리·앱 열기 묶음, 누른 칸에 띠, 설정은 맨 아래, 아래 탭은 없음', async ({ page }) => {
  await login(page);
  const nav = page.getByRole('navigation', { name: '미니허브 메뉴' });
  await expect(nav).toContainText('보기');
  await expect(nav).toContainText('관리');
  await expect(nav).toContainText('앱 열기');
  await nav.getByRole('link', { name: '월간 보고' }).click();
  await expect(nav.getByRole('link', { name: '월간 보고' })).toHaveAttribute('aria-current', 'true');
  await expect(page).toHaveURL(/#monthly$/);
  await expect(page.getByRole('link', { name: '설정', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '미니허브 아래 탭' })).toBeHidden();
});

test('휴대폰: 아래 탭 4개와 톱니로 이동하고, 사람별 표는 사람마다 카드로 보이며 옆으로 넘치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const tabs = page.getByRole('navigation', { name: '미니허브 아래 탭' });
  await expect(tabs.getByRole('link')).toHaveText(['대시보드', '월간 보고', '앱 연결', 'AI 사용량']);
  await expect(page.getByRole('navigation', { name: '미니허브 메뉴' })).toBeHidden();
  await tabs.getByRole('link', { name: '앱 연결 탭' }).click();
  await expect(page).toHaveURL(/#apps$/);
  await tabs.getByRole('link', { name: 'AI 사용량 탭' }).click();
  await expect(page.getByRole('button', { name: '나만', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: '설정 열기' }).click();
  await expect(page).toHaveURL(/#settings$/);
  await page.getByRole('button', { name: '두 사람 같이' }).click();
  await expect(page.locator('.people tr.user-row').first()).toBeVisible();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(0);
});
