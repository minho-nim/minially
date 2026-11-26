import { test, expect, type Page } from '@playwright/test';

// 켤 때 새 버전 알림: 3초 뒤 확인, 웹은 version.json, Windows 앱은 업데이트 상태, 업데이트 뒤 첫 실행은 '바뀌었어요'
const ready = (page: Page) => page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();

for (const width of [1400, 390]) test(`웹: 서버에 새 버전이 있으면 3초 뒤 알리고, 닫으면 같은 버전은 다시 안 띄운다 · ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 860 });
  let asked = 0;
  await page.route('**/version.json*', route => { asked++; return route.fulfill({ json: { version: '9.9.9', commit: 'test' } }); });
  const started = Date.now();
  await page.goto('/'); await ready(page);
  const notice = page.getByRole('status', { name: '새 버전 알림' });
  await expect(notice).toContainText('새 버전 V.9.9.9이 있어요', { timeout: 8000 });
  expect(Date.now() - started).toBeGreaterThanOrEqual(2500); // 켜자마자가 아니라 3초 뒤
  await expect(notice.getByRole('button', { name: '새로고침' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await notice.getByRole('button', { name: '새 버전 알림 닫기' }).click();
  await expect(notice).toHaveCount(0);
  await page.reload(); await ready(page);
  await expect.poll(() => asked).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(500);
  await expect(notice).toHaveCount(0);
});

test('웹: 서버 버전이 같거나 낮거나 못 읽으면 알리지 않는다', async ({ page }) => {
  await page.route('**/version.json*', route => route.fulfill({ json: { version: '0.0.1' } }));
  await page.goto('/'); await ready(page);
  await page.waitForTimeout(3800);
  await expect(page.getByRole('status', { name: '새 버전 알림' })).toHaveCount(0);
});

test('업데이트 뒤 처음 켜면 바뀐 점을 한 번 보여 주고, 처음 설치면 조용하다', async ({ page }) => {
  await page.route('**/version.json*', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/'); await ready(page);
  const notice = page.getByRole('status', { name: '새 버전 알림' });
  await expect(notice).toHaveCount(0); // 처음 설치: 기록만 남김
  await page.evaluate(() => localStorage.setItem('minially.version.seen', '0.0.1'));
  await page.reload(); await ready(page);
  await expect(notice).toContainText('로 바뀌었어요');
  await notice.getByRole('button', { name: '바뀐 점 보기' }).click();
  await expect(notice.getByRole('listitem').first()).toBeVisible();
  await page.reload(); await ready(page);
  await expect(notice).toHaveCount(0); // 한 번만
});

test('Windows 앱: 켜고 3초 뒤 새 버전이 받아져 있으면 지금 재시작을 주고, 저장 확인에 막히면 안내한다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.addInitScript(() => {
    let state: any = { version: '0.1.2', window: { focused: true, maximized: false }, platform: 'win32', preferences: { alwaysOnTop: false, startOnLogin: false, closeToTray: true, autoDownload: true }, update: { kind: 'ready', version: '0.1.3', percent: 100 }, shortcutAvailable: true, canStartOnLogin: true };
    const listeners = new Set<any>();
    (window as any).__installs = 0;
    (window as any).miniallyDesktop = { mode: 'main', windowAction: async () => {}, getState: async () => state, onState: (fn: any) => { listeners.add(fn); return () => listeners.delete(fn); }, onRefresh: () => () => {}, onOpenNote: () => () => {}, onPrepareClose: () => () => {}, updatePreferences: async () => state, showQuick: async () => {}, checkUpdate: async () => state.update, downloadUpdate: async () => state.update, installUpdate: async () => { (window as any).__installs++; throw Error('unsaved'); } };
  });
  let asked = 0;
  await page.route('**/version.json*', route => { asked++; return route.fulfill({ json: { version: '9.9.9' } }); });
  await page.goto('/'); await ready(page);
  const notice = page.getByRole('status', { name: '새 버전 알림' });
  await expect(notice).toContainText('새 버전 V.0.1.3 준비됨', { timeout: 8000 });
  await notice.getByRole('button', { name: '지금 재시작' }).click();
  await expect(notice.getByRole('alert')).toContainText('저장 상태');
  expect(await page.evaluate(() => (window as any).__installs)).toBe(1);
  expect(asked).toBe(0); // 앱에서는 웹 버전 파일을 보지 않음
});
