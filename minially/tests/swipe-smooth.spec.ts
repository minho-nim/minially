import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test('달력을 손가락으로 끄는 동안 달력 내용은 다시 그리지 않고 위치만 옮긴다(부드러운 넘김)', async ({ page }) => {
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto('/');
  await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  const calendar = page.locator('[data-calendar-swipe]');
  await page.waitForTimeout(600); // 앞뒤 달 미리 그리기
  // 달력 세 장 안의 변화(추가·삭제·글자·속성)를 센다. 트랙의 transform은 바깥이라 세지 않음
  await page.evaluate(() => {
    const w = window as unknown as { __muts: number };
    w.__muts = 0;
    const track = document.querySelector('[data-calendar-swipe] [data-swipe-track]')!;
    new MutationObserver(list => { w.__muts += list.length; }).observe(track, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'data-calendar-date', 'aria-label'] });
  });
  const box = (await calendar.boundingBox())!;
  const y = box.y + box.height / 2;
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * 0.75, y }] });
  for (let step = 1; step <= 12; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * 0.75 - step * 12, y }] });
  await expect(calendar).toHaveAttribute('data-swipe-phase', 'dragging');
  await page.waitForTimeout(100);
  // 끄는 동안(처음 'dragging' 표시 한 번 뺀) 달력 내용 변화가 없어야 한다
  expect(await page.evaluate(() => (window as unknown as { __muts: number }).__muts)).toBeLessThanOrEqual(2);
  const before = await page.locator('[data-swipe-current]').evaluate(e => e.getBoundingClientRect().x);
  expect(before).toBeLessThan(box.x - 100); // 손가락을 따라 왼쪽으로 움직임
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(calendar).toHaveAttribute('data-swipe-phase', 'idle');
});
