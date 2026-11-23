import { test, expect } from '@playwright/test';

const MINLAB = 'https://minho-nim.github.io/MinLab/';

// 지원서에 링크 3개가 쉼표로 붙어 한 주소로 올라간 경우: 메인인 MinLab 아카이브로 보낸다.
test('쉼표로 붙은 포트폴리오 주소는 MinLab으로 보낸다', async ({ page }) => {
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.route(`${MINLAB}**`, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>MinLab</title>' }));
  await page.goto('/portfolio,%20https://minlab-ai-office.pages.dev/portfolio,%20https://minho-nim.github.io/MinLab/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(MINLAB);
});

test('쉼표가 %2C로 바뀐 주소도 MinLab으로 보낸다', async ({ page }) => {
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.route(`${MINLAB}**`, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>MinLab</title>' }));
  await page.goto('/portfolio%2C%20https://minlab-ai-office.pages.dev/portfolio%2C%20https://minho-nim.github.io/MinLab/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(MINLAB);
});

test('쉼표 없는 /portfolio 는 MinLab으로 보내지 않는다', async ({ page }) => {
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto('/portfolio', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  expect(page.url()).not.toContain('minho-nim.github.io');
});
