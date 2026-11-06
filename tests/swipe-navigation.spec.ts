import { test, expect, type Page, type Locator } from '@playwright/test';
import { chooseDate, expectDate } from './helpers/date';

async function swipe(page: Page, target: Locator, direction: 'left' | 'right' | 'vertical' | 'small') {
  const box = (await target.boundingBox())!;
  const left = box.x + box.width * 0.28, right = box.x + box.width * 0.72;
  const y = box.y + box.height / 2;
  const start = { x: direction === 'left' ? right : left, y };
  const end = direction === 'vertical' ? { x: left + 4, y: y - 70 } : { x: direction === 'small' ? left + 20 : direction === 'left' ? left : right, y };
  const initialX = (await target.locator('[data-swipe-current]').boundingBox())!.x;
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  for (let step = 1; step <= 6; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (end.x - start.x) * step / 6, y: start.y + (end.y - start.y) * step / 6 }] });
  }
  if (direction !== 'vertical') {
    await expect(target).toHaveAttribute('data-swipe-phase','dragging');
    await expect.poll(async () => { const movedX = (await target.locator('[data-swipe-current]').boundingBox())!.x; return Math.abs((movedX - initialX) - (end.x - start.x)); }).toBeLessThan(3);
    if (direction === 'left') await page.screenshot({path:`test-results/drag-${await target.getAttribute('data-calendar-swipe')?'calendar':'tasks'}-${page.viewportSize()!.width}.png`});
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
  await expect(target).toHaveAttribute('data-swipe-phase','idle');
}

for (const width of [390, 1280]) {
  test.describe(`touch navigation ${width}`, () => {
    test.use({ viewport: { width, height: 844 }, hasTouch: true });
    test('calendar changes months and task swipes share date navigation without accidental taps', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
      const current = await page.evaluate(() => {
        const date = new Date();
        const format = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const next = new Date(date); next.setDate(next.getDate() + 1);
        return { today: format(date), tomorrow: format(next), month: `${date.getFullYear()}년 ${date.getMonth() + 1}월`, nextMonth: `${new Date(date.getFullYear(), date.getMonth() + 1, 1).getFullYear()}년 ${new Date(date.getFullYear(), date.getMonth() + 1, 1).getMonth() + 1}월` };
      });
      const calendar = page.locator('[data-calendar-swipe]');
      const heading = page.locator('.calendar-view h2');
      await expect(heading).toHaveText(current.month);
      await swipe(page, calendar, 'left');
      await expect(heading).toHaveText(current.nextMonth);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await swipe(page, calendar, 'right');
      await expect(heading).toHaveText(current.month);
      await swipe(page, calendar, 'vertical');
      await expect(heading).toHaveText(current.month);
      await swipe(page, calendar, 'small');
      await expect(heading).toHaveText(current.month);
      await page.locator(`[data-calendar-date="${current.today}"]`).click({ position: { x: 5, y: 5 } });
      await expect(page.getByRole('dialog', { name: '날짜별 일정', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '날짜 팝업 닫기' }).click();
      await page.getByRole('button', { name: '할 일', exact: true }).filter({ visible: true }).first().click();
      const list = page.locator('[data-task-swipe]');
      const empty = list.getByText('등록된 할 일이 없습니다.', { exact: true });
      await expect(empty).toBeVisible();
      const initialHeight = (await list.boundingBox())!.height;
      expect(initialHeight).toBeGreaterThanOrEqual(156);
      await page.screenshot({path:`test-results/task-empty-reserved-${width}.png`});
      await swipe(page, list, 'left');
      await expectDate(page, '조회 날짜', current.tomorrow);
      await swipe(page, list, 'right');
      await expectDate(page, '조회 날짜', current.today);
      await swipe(page, list, 'vertical');
      await expectDate(page, '조회 날짜', current.today);
      await chooseDate(page, '조회 날짜', '2026-12-31');
      await swipe(page, list, 'left');
      await expectDate(page, '조회 날짜', '2027-01-01');
      await swipe(page, list, 'right');
      await expectDate(page, '조회 날짜', '2026-12-31');
      await page.getByRole('button', { name: '오늘', exact: true }).click();
      await expectDate(page, '조회 날짜', current.today);
      const title = page.getByRole('textbox', { name: '새 할 일 제목' });
      await title.fill('스와이프 후 등록');
      await title.press('Enter');
      await expect(list.getByText('스와이프 후 등록', { exact: true })).toBeVisible();
      await expect(title).toBeFocused();
      expect((await list.boundingBox())!.height).toBe(initialHeight);
      await swipe(page, list, 'left');
      await expect(list.getByText('스와이프 후 등록', { exact: true })).toHaveCount(0);
      await swipe(page, list, 'right');
      await expect(list.getByText('스와이프 후 등록', { exact: true })).toBeVisible();
      for (let index=0; index<5; index++) { await title.fill('공간 채우기 '+index); await title.press('Enter'); await expect(title).toHaveValue(''); }
      expect((await list.boundingBox())!.height).toBe(initialHeight);
      expect(await list.locator('[data-task-list]').evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
      expect(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await page.screenshot({ path: `test-results/task-swipe-${width}.png` });
    });
  });
}
