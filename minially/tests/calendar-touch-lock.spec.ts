import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test('휴대폰 달력은 위아래로 끌어도 움직이지 않고 옆으로 밀면 달이 넘어간다', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  const calendar = page.locator('[data-calendar-swipe]');
  expect(await calendar.evaluate(el => getComputedStyle(el).touchAction)).toBe('pinch-zoom');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY)).toBe('none');
  const title = page.locator('h2').first(), before = await title.innerText(), top = (await calendar.boundingBox())!.y;
  const session = await page.context().newCDPSession(page);
  const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
    for (let step = 1; step <= 10; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 10, y: from.y + (to.y - from.y) * step / 10 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await drag({ x: 200, y: 520 }, { x: 200, y: 260 });
  await page.waitForTimeout(400);
  expect((await calendar.boundingBox())!.y).toBe(top);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expect(title).toHaveText(before);
  await drag({ x: 320, y: 450 }, { x: 60, y: 452 });
  await expect(title).not.toHaveText(before);
});
