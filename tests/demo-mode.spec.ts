import { test, expect, type Page } from '@playwright/test';

// 체험은 /portfolio/demo 주소로만 시작한다. 로그인 우회(minially-sync-skip) 없이 실제 첫 화면에서 시작한다.
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const countSchedules = (page: Page) => page.evaluate(() => new Promise<number>(resolve => {
  const req = indexedDB.open('DayFlowDB');
  req.onsuccess = () => { const c = req.result.transaction('schedules').objectStore('schedules').count(); c.onsuccess = () => resolve(c.result); };
}));

test('로그인 화면에는 체험 단추가 없다', async ({ page }) => {
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('dialog', { name: '연결 코드 입력' })).toBeVisible();
  await expect(page.getByText('체험', { exact: false })).toHaveCount(0);
});

test('체험 주소로 들어오면 예시 데이터가 보이고, 서버에 요청하지 않으며, 끝내면 지워진다', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', r => { if (r.url().includes('/api/')) apiCalls.push(r.url()); });
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto('/portfolio/demo', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('체험 모드', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-calendar-date]').first()).toBeVisible();
  await expect(page.getByText('친구', { exact: false }).first()).toBeVisible();

  // 예시 데이터: 지난달~다음 달 3개월치, 반복 일정은 프리셋으로 넣었고 프리셋 그룹이 있다
  const info = await page.evaluate(() => new Promise<{ months: string[]; fromPreset: number; groups: string[]; presets: number }>(resolve => {
    const req = indexedDB.open('DayFlowDB');
    req.onsuccess = () => {
      const tx = req.result.transaction(['schedules', 'presets', 'appSettings']);
      const s = tx.objectStore('schedules').getAll(), p = tx.objectStore('presets').getAll(), a = tx.objectStore('appSettings').get('global_settings');
      tx.oncomplete = () => resolve({
        months: [...new Set((s.result as { date: string }[]).map(x => x.date.slice(0, 7)))].sort(),
        fromPreset: (s.result as { presetId?: string }[]).filter(x => x.presetId).length,
        groups: ((a.result?.presetGroups ?? []) as { name: string }[]).map(g => g.name),
        presets: (p.result as unknown[]).length,
      });
    };
  }));
  const now = new Date(), m = (o: number) => { const d = new Date(now.getFullYear(), now.getMonth() + o, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  expect(info.months).toEqual([m(-1), m(0), m(1)]);
  expect(info.fromPreset).toBeGreaterThan(30);
  expect(info.groups).toEqual(['공부', '운동', '약속']);
  expect(info.presets).toBe(7);

  // 새로고침해도 체험이 이어지고, 체험 중 만든 기록이 예시 데이터로 덮이지 않는다
  const before = await countSchedules(page);
  await page.reload();
  await expect(page.getByText('체험 모드', { exact: true })).toBeVisible({ timeout: 15000 });
  expect(await countSchedules(page)).toBe(before);

  await page.getByRole('button', { name: '설정', exact: true }).first().click();
  const settings = page.getByRole('dialog', { name: '설정' });
  await expect(settings.getByRole('button', { name: '체험 끝내기', exact: true })).toBeVisible();
  await settings.getByRole('button', { name: '공유' }).click();
  await expect(settings.getByText('체험 모드에서는 일정 공유')).toBeVisible();
  await settings.getByRole('button', { name: '백업/복원' }).click();
  await expect(settings.getByRole('button', { name: '체험 끝내고 로그인하기' })).toBeVisible();

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '체험 끝내기', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: '연결 코드 입력' })).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveURL(/\/$/);
  expect(await countSchedules(page)).toBe(0);
  expect(apiCalls).toEqual([]);
});

test('코드로 로그인한 기기에서 체험 주소를 열어도 내 데이터를 지우지 않는다', async ({ page }) => {
  await page.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"시험"}' }));
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    localStorage.setItem('minially-sync-v1', JSON.stringify({ code: 'TESTCODE0000000', lastSeq: 0, shadow: {} }));
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('DayFlowDB');
      req.onsuccess = () => {
        const tx = req.result.transaction('schedules', 'readwrite');
        tx.objectStore('schedules').put({ id: 'mine-1', date: '2026-11-13', title: '내 일정', category: '', completed: false });
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.goto('/portfolio/demo', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('체험 모드', { exact: true })).toHaveCount(0);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => localStorage.getItem('minially-demo'))).toBeNull();
  const ids = await page.evaluate(() => new Promise<string[]>(resolve => {
    const req = indexedDB.open('DayFlowDB');
    req.onsuccess = () => { const g = req.result.transaction('schedules').objectStore('schedules').getAllKeys(); g.onsuccess = () => resolve(g.result as string[]); };
  }));
  expect(ids).toContain('mine-1');
});
