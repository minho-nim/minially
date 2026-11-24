import { test, expect } from '@playwright/test';

// 설치형 앱(제목 표시줄 40px)에서 탭마다 머리줄 위치가 같고, 머리줄이 내용을 가리지 않는다.
// (캘린더·메모는 화면 안에서 따로 스크롤해서 머리줄이 40px 더 내려가 메모 위쪽·삭제 버튼을 가리던 문제)
test('설치형 앱: 캘린더·할 일·메모 머리줄 위치가 같고 메모 위쪽이 가려지지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    const state: any = { version: '0.1.9', window: { focused: true, maximized: false }, platform: 'win32', preferences: { alwaysOnTop: false, startOnLogin: false, closeToTray: true, autoDownload: true, zoomFactor: 1 }, update: { kind: 'idle', version: '0.1.9', percent: 0 }, shortcutAvailable: true, canStartOnLogin: true };
    (window as any).miniallyDesktop = { mode: 'main', windowAction: async () => {}, getState: async () => state, onState: () => () => {}, onRefresh: () => () => {}, onOpenNote: () => () => {}, onPrepareClose: () => () => {}, updatePreferences: async () => state, showQuick: async () => {}, checkUpdate: async () => {}, downloadUpdate: async () => {}, installUpdate: async () => {}, notifySaved: () => {}, zoom: async () => {} };
  });
  await page.setViewportSize({ width: 1040, height: 640 });
  await page.goto('/');
  await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  const header = page.locator('header.app-titlebar');
  const positions: Record<string, { top: number; bottom: number; mainTop: number }> = {};
  for (const tab of ['캘린더', '할 일', '메모']) {
    await page.getByRole('button', { name: tab, exact: true }).filter({ visible: true }).first().click();
    if (tab === '메모') await page.getByRole('button', { name: '새 메모' }).first().click();
    await page.waitForTimeout(300);
    const box = (await header.boundingBox())!;
    const mainTop = (await page.locator('main').boundingBox())!.y;
    positions[tab] = { top: Math.round(box.y), bottom: Math.round(box.y + box.height), mainTop: Math.round(mainTop) };
  }
  expect(positions['캘린더'].top).toBe(40);
  expect(positions['할 일'].top).toBe(40);
  expect(positions['메모'].top).toBe(40);
  for (const p of Object.values(positions)) expect(p.bottom).toBeLessThanOrEqual(p.mainTop + 1); // 머리줄이 내용을 가리지 않음
  // 메모: 분류 제목과 편집기의 휴지통 버튼이 보이고 머리줄 아래에 있다
  const notesHeading = (await page.getByRole('heading', { name: '메모', exact: true }).boundingBox())!;
  expect(notesHeading.y).toBeGreaterThanOrEqual(positions['메모'].bottom);
  const trash = page.getByRole('button', { name: '메모 휴지통으로' });
  await expect(trash).toBeVisible();
  expect((await trash.boundingBox())!.y).toBeGreaterThanOrEqual(positions['메모'].bottom);
});
