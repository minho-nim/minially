import { test, expect } from '@playwright/test';
import { startQuick } from './helpers/category';
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('입력 시트: 키보드가 열린 채 바깥을 누르면 키보드만 내리고, 바깥을 끌면 뒤 화면이 움직이지 않음', async ({ page, context }) => {
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.locator('[data-calendar-date]').nth(15).click({ position: { x: 5, y: 5 } });
  const sheet = page.getByRole('dialog', { name: '날짜별 일정', exact: true });
  const title = await startQuick(sheet); await title.fill('작성 중'); await title.focus(); await expect(title).toBeFocused();
  const composer = sheet.locator('[data-quick-composer]');
  // 바깥 누르기 → 키보드(포커스)만 내려가고 입력 시트·날짜 팝업·입력 내용은 그대로
  await page.touchscreen.tap(195, 120);
  await expect(title).not.toBeFocused(); await expect(composer).toBeVisible(); await expect(sheet).toBeVisible(); await expect(title).toHaveValue('작성 중');
  // 바깥 끌기 → 기본 스크롤이 막힌다
  await page.evaluate(() => { (window as any).__moves = []; document.addEventListener('touchmove', e => (window as any).__moves.push(e.defaultPrevented), { passive: true }); });
  await title.focus();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 300 }] });
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 300 + i * 30 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const moves: boolean[] = await page.evaluate(() => (window as any).__moves);
  expect(moves.length).toBeGreaterThan(0); expect(moves.every(Boolean)).toBe(true);
  await expect(composer).toBeVisible(); await expect(sheet).toBeVisible();
  // 키보드가 내려간 상태에서 바깥을 누르면 예전처럼 입력 시트가 닫힌다
  await title.evaluate((el: HTMLElement) => el.blur());
  await page.touchscreen.tap(195, 120); await expect(composer).toHaveCount(0); await expect(sheet).toBeVisible();
});

async function moves(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext, from: { x: number; y: number }) {
  await page.evaluate(() => { (window as any).__moves = []; document.addEventListener('touchmove', e => (window as any).__moves.push(e.defaultPrevented), { passive: true }); });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x, y: from.y + i * 30 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return page.evaluate(() => (window as any).__moves as boolean[]);
}

test('검색: 키보드가 열린 채 바깥을 누르면 키보드만 내리고 창은 그대로, 바깥 끌기 막힘', async ({ page, context }) => {
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.getByRole('navigation', { name: '하단 메뉴' }).getByRole('button', { name: '검색', exact: true }).tap();
  const search = page.getByRole('dialog', { name: '일정 검색', exact: true }); const box = search.getByLabel('일정 검색어', { exact: true });
  await box.fill('회의'); await box.focus(); await expect(box).toBeFocused();
  const drag = await moves(page, context, { x: 195, y: 790 }); expect(drag.length).toBeGreaterThan(0); expect(drag.every(Boolean)).toBe(true);
  await box.focus(); await expect(box).toBeFocused(); // 끌기에서 키보드가 내려갔으므로 다시 연 상태로
  await page.touchscreen.tap(195, 830);
  await expect(box).not.toBeFocused(); await expect(search).toBeVisible(); await expect(box).toHaveValue('회의');
});

test('할 일: 키보드가 열린 채 바깥(하단 메뉴 등)을 누르면 키보드만 내리고 화면 이동 없음', async ({ page }) => {
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  const nav = page.getByRole('navigation', { name: '하단 메뉴' });
  await nav.getByRole('button', { name: '할 일', exact: true }).tap();
  const title = page.getByRole('form', { name: '할 일 등록' }).getByLabel('새 할 일 제목'); await title.fill('작성 중인 할 일'); await title.focus();
  await nav.getByRole('button', { name: '캘린더', exact: true }).tap();
  await expect(title).not.toBeFocused(); await expect(title).toBeVisible(); await expect(title).toHaveValue('작성 중인 할 일');
  await nav.getByRole('button', { name: '캘린더', exact: true }).tap(); await expect(title).toHaveCount(0); // 키보드가 내려간 뒤에는 정상 동작
});
