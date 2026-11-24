import { expect, test } from '@playwright/test';
for (const width of [360, 390]) test.describe(`${width}`, () => {
test.use({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
test('공휴일 이름·일정 이름이 좁은 칸에 맞게 보인다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-08-10T09:00:00+09:00') });
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  const s = (id: string, title: string, date: string) => ({ id, title, date, category: 'cat', completed: false });
  await page.evaluate(async schedules => { const path = '/src/db/indexedDB.ts'; await (await import(path)).importAllData({ schedules, categories: [{ id: 'cat', name: '분류', color: '#CF8FA8' }] }); },
    [s('a', '낙성대 데이트', '2026-08-02'), s('b', '집데이트', '2026-08-07'), s('c', '삼각지 데이트', '2026-08-08'), s('d', '용산 데이트', '2026-08-09'), s('e', '잠실 롯데월드', '2026-08-16')]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  const label = page.locator('[data-calendar-date="2026-08-17"] [data-holiday-name]');
  await expect(label).toHaveText('대체공휴일');
  await page.screenshot({ path: `/tmp/claude-0/-home-user/4d0a2dd8-a259-562b-96ae-e274d08bd764/scratchpad/titles-${width}.png` });
  expect(await label.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true); // 좁은 폰에서도 잘리지 않음
  // 일정 이름은 글자 수로 자르지 않고 칸 너비만큼(5글자 안팎)
  await expect(page.locator('[data-calendar-date="2026-08-02"] [data-calendar-title]').first()).toHaveText('낙성대 데이트');
  await expect(page.locator('[data-calendar-date="2026-08-08"] [data-date-number]')).toHaveClass(/3D7BD9/); // 토요일 파랑
});
});
