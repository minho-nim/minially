import { expect, test } from '@playwright/test';
// 휴대폰 할 일 화면: 고르기 칸(하루·기간, 모두·미완료·완료) 안의 선택 버튼이 칸 밖으로 삐져나오지 않고, 옆 버튼과 높이가 같다
test('휴대폰 할 일 고르기 칸 높이가 옆 버튼과 같고 선택 칸이 테두리 안에 있다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await page.getByRole('button', { name: '할 일', exact: true }).filter({ visible: true }).first().click();
  const importBtn = (await page.getByRole('button', { name: '미완료 가져오기' }).boundingBox())!;
  for (const name of ['조회 방식', '할 일 완료 필터']) {
    const group = page.getByRole('group', { name });
    const outer = (await group.boundingBox())!;
    expect(Math.round(outer.height)).toBe(Math.round(importBtn.height));
    for (const b of await group.getByRole('button').all()) {
      const r = (await b.boundingBox())!;
      expect(r.y).toBeGreaterThanOrEqual(outer.y - 0.5);
      expect(r.y + r.height).toBeLessThanOrEqual(outer.y + outer.height + 0.5);
    }
  }
});
