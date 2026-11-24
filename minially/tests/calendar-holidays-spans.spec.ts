import { test, expect } from '@playwright/test';
import { holidaysOfYear, longWeekends } from '../src/utils/koreanHolidays';

test('대한민국 공휴일·대체공휴일·연휴를 계산한다', () => {
  const subs = (y: number) => [...holidaysOfYear(y)].filter(([, h]) => h.some(x => x.substitute)).map(([d]) => d).sort();
  expect(subs(2025)).toEqual(['2025-03-03', '2025-05-06', '2025-10-08']);
  expect(subs(2026)).toEqual(['2026-03-02', '2026-05-25', '2026-08-17', '2026-10-05']);
  const y2026 = holidaysOfYear(2026);
  expect(['2026-02-16', '2026-02-17', '2026-02-18'].map(d => y2026.get(d)?.[0].name)).toEqual(['설날', '설날', '설날']);
  expect(y2026.get('2026-07-17')?.[0].name).toBe('제헌절');
  expect(y2026.get('2026-06-03')?.[0].name).toBe('지방선거일');
  expect(longWeekends('2026-02-01', '2026-02-28').get('2026-02-18')).toEqual({ start: '2026-02-14', days: 5 });
  expect(longWeekends('2026-04-01', '2026-04-30').size).toBe(0); // 공휴일 없는 주말은 연휴가 아니다
});

for (const width of [390, 1280]) test.describe(`${width}px 달력 공휴일·이어진 일정`, () => {
  test.use({ viewport: { width, height: 844 }, isMobile: width < 640, hasTouch: width < 640 });
  test('공휴일 이름·연휴 표시, 며칠 이어진 일정은 한 줄로 이어 그린다', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-02-10T09:00:00+09:00') });
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
    const trip = ['2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17'].map((date, i) => ({ id: 'trip' + i, title: '설 여행', date, category: 'cat', completed: false }));
    await page.evaluate(async schedules => { const path = '/src/db/indexedDB.ts'; await (await import(path)).importAllData({ schedules, categories: [{ id: 'cat', name: '분류', color: '#CF8FA8' }] }); },
      [...trip, { id: 'one', title: '치과', date: '2026-02-16', category: 'cat', completed: false }, { id: 'other', title: '설 여행', date: '2026-02-20', category: 'cat', completed: false }]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const cell = (d: string) => page.locator(`[data-calendar-date="${d}"]`);
    await expect(cell('2026-02-17')).toHaveAttribute('data-holiday', '설날');
    await expect(cell('2026-02-17').locator('[data-holiday-name]')).toHaveText('설날');
    await expect(cell('2026-02-14')).toHaveAttribute('data-long-weekend', '5');
    await expect.poll(() => cell('2026-02-14').locator('[data-holiday-name]').innerText()).toBe(width < 640 ? '연휴' : '5일 연휴'); // 보이는 글자만
    await expect(cell('2026-02-10')).not.toHaveAttribute('data-long-weekend');
    const chips = page.locator('[data-span="4"]').filter({ visible: true });
    await expect(chips).toHaveCount(4);
    // 첫날과 주의 첫 칸(15일, 일요일)에만 이름, 나머지는 비워서 이어 보인다
    await expect(chips.nth(0)).toContainText('설 여행');
    await expect(chips.nth(1)).toContainText('설');
    expect((await chips.nth(2).innerText()).trim()).toBe('');
    // 같은 주(15~17일)에서는 같은 높이, 옆 칸과 빈틈 없이 붙는다
    const boxes = await Promise.all([1, 2, 3].map(i => chips.nth(i).boundingBox()));
    expect(new Set(boxes.map(b => Math.round(b!.y))).size).toBe(1);
    expect(Math.abs(boxes[0]!.x + boxes[0]!.width - boxes[1]!.x)).toBeLessThanOrEqual(1);
    // 떨어진 날의 같은 이름은 따로(이어지지 않음)
    await expect(cell('2026-02-20').locator('[data-span]')).toHaveCount(0);
    await page.screenshot({ path: `test-results/calendar-holidays-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
});
