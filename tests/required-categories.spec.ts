import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) {
  test.describe(`required categories ${width}`, () => {
    test.use({ viewport: { width, height: 844 } });
    test('quick entry starts with category cards and detailed entry requires a category', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
      const cell = page.locator('[data-calendar-date]').nth(15);
      await cell.click({ position: { x: 5, y: 5 } });
      const sheet = page.getByRole('dialog', { name: '날짜별 일정', exact: true });
      await sheet.getByRole('button', { name: '일정을 추가하세요', exact: true }).click();
      const cards = sheet.getByRole('group', { name: '카테고리 목록' });
      await expect(cards).toBeVisible();
      await expect(cards.getByRole('button')).toHaveCount(4);
      await expect(sheet.getByText('미분류 (선택 해제)', { exact: true })).toHaveCount(0);
      await page.screenshot({ path: `test-results/quick-category-${width}.png` });
      expect(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await cards.getByRole('button', { name: '일', exact: true }).click();
      const title = sheet.getByRole('textbox', { name: '빠른 일정 제목' });
      await expect(title).toBeFocused();
      await title.fill('분류 필수 간편 일정');
      await title.press('Enter');
      await expect(title).toHaveValue('');
      await expect.poll(() => page.evaluate(async () => {
        const path = '/src/db/indexedDB.ts';
        return (await (await import(path)).getAllSchedules()).find((s: any) => s.title === '분류 필수 간편 일정')?.category;
      })).toBe('category-work');
      await sheet.getByRole('button', { name: '빠른 등록 카테고리 선택' }).click();
      await cards.getByRole('button', { name: '일', exact: true }).click();
      await expect(sheet.getByRole('button', { name: '빠른 등록 카테고리 선택' })).toContainText('일');
      await sheet.getByRole('button', { name: '날짜 팝업 닫기' }).click();
      await page.getByRole('button', { name: '일정 등록', exact: true }).click();
      const detail = page.getByRole('dialog', { name: '새 일정', exact: true });
      await detail.getByPlaceholder('일정 제목을 입력하세요').fill('분류 필수 상세 일정');
      await detail.getByRole('button', { name: '등록', exact: true }).click();
      await expect(detail.getByRole('group', { name: '카테고리 목록' })).toBeVisible();
      expect(await page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await (await import(path)).getAllSchedules()).length; })).toBe(1);
      await detail.getByRole('group', { name: '카테고리 목록' }).getByRole('button', { name: '기타', exact: true }).click();
      await detail.getByRole('button', { name: '등록', exact: true }).click();
      await expect(detail).toHaveCount(0);
      await page.reload();
      await expect.poll(() => page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await (await import(path)).getAllSchedules()).find((s: any) => s.title === '분류 필수 상세 일정')?.category; })).toBe('category-other');
    });
  });
}

test('legacy schedules, backup imports, atomic validation and fixed unique colors', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  const result = await page.evaluate(async () => {
    const path = '/src/db/indexedDB.ts', db = await import(path);
    await db.importAllData({ categories: [
      { id: 'a', name: '기존 A', color: '#CF8FA8', isUserManaged: true },
      { id: 'b', name: '기존 B', color: '#cf8fa8', isUserManaged: true },
    ], schedules: [{ id: 'old', title: '기존 일정', date: '2026-11-06', category: '', memo: '보존' }], recurrenceExceptions: [{ id: 'ex', ruleId: 'r', originalDate: '2026-11-06', type: 'modify', modifiedSchedule: { category: '' } }] });
    const migrated = await db.exportAllData();
    const errors: string[] = [];
    const attempt = async (action: () => Promise<unknown>) => { try { await action(); } catch (error) { errors.push(String(error)); } };
    await attempt(() => db.saveCategory({ ...migrated.categories.find((c: any) => c.id === 'a'), color: '#B4A2D3' }));
    await attempt(() => db.saveCategory({ id: 'duplicate', name: '중복', color: '#CF8FA8' }));
    await attempt(() => db.saveSchedule({ id: 'invalid', title: '미분류 차단', date: '2026-11-06', category: '' }));
    await attempt(() => db.batchSaveSchedules([{ id: 'valid', title: '배치도 원자적', date: '2026-11-06', category: 'a' }, { id: 'invalid2', title: '잘못된 분류', date: '2026-11-06', category: 'missing' }]));
    await attempt(() => db.applyScheduleHistory({ id: 'h', timestamp: Date.now(), action: 'CREATE', description: '', previousSchedules: [], newSchedules: [{ id: 'invalid-history', title: '실행 취소 경로', date: '2026-11-06', category: '' }] }));
    const freeColor = '#9DB6A2';
    const concurrent = await Promise.allSettled(['one','two'].map(id => db.saveCategory({ id, name: id, color: freeColor })));
    const after = await db.exportAllData();
    await attempt(() => db.deleteCategory(after.schedules[0].category));
    return { migrated, after, errors, concurrent: concurrent.map(r => r.status) };
  });
  expect(result.migrated.categories.map((c: any) => c.id)).toEqual(expect.arrayContaining(['a', 'b']));
  expect(new Set(result.after.categories.map((c: any) => c.color.toLowerCase())).size).toBe(result.after.categories.length);
  const fallback = result.migrated.categories.find((c: any) => c.name === '기타');
  expect(result.migrated.schedules[0]).toMatchObject({ id: 'old', category: fallback.id, memo: '보존' });
  expect(result.migrated.recurrenceExceptions[0].modifiedSchedule.category).toBe(fallback.id);
  expect(result.after.schedules).toHaveLength(1);
  expect(result.after.categories.find((c: any) => c.id === 'a').color).toBe('#CF8FA8');
  expect(result.errors).toHaveLength(6);
  expect(result.concurrent.sort()).toEqual(['fulfilled','rejected']);
});
