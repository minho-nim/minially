import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test.describe(`calendar and category ${viewport.width}px`, () => {
    test.use({ viewport });
    test('fixed category color and today-to-task registration persist without duplicates', async ({ page }) => {
      await page.route('**/fonts.googleapis.com/**', route => route.abort());
      await page.goto('/');
      await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
      await page.evaluate(async () => {
        const path = '/src/db/indexedDB.ts';
        const db = await import(path);
        const date = new Date();
        const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        await db.importAllData({
          categories: [{ id: 'custom', name: '직접 만든 색', color: '#CF8FA8', isUserManaged: true }],
          schedules: [{ id: 'today-event', title: '오늘 약속', date: today, category: 'custom', completed: false, memo: '준비물', isImportant: true, startTime: '09:00', endTime: '10:00' }],
          tasks: [], recurrenceRules: [], recurrenceExceptions: [],
        });
      });
      await page.reload();
      await page.getByRole('button', { name: '카테고리', exact: true }).click();
      const category = page.getByRole('dialog', { name: '카테고리 관리', exact: true });
      await category.locator('[data-category-id="custom"]').getByRole('button', { name: '수정', exact: true }).click();
      await expect(category.getByLabel('직접 색상 선택', { exact: true })).toHaveCount(0);
      await category.getByPlaceholder('카테고리 이름').fill('이름 수정');
      await category.getByRole('button', { name: '변경사항 저장', exact: true }).click();
      await expect.poll(() => page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await (await import(path)).getAllCategories()).find((item: any) => item.id === 'custom')?.color; })).toBe('#CF8FA8');
      await category.getByRole('button', { name: '카테고리 관리 닫기' }).click();
      await page.getByRole('button', { name: '할 일', exact: true }).filter({ visible: true }).first().click();
      await page.getByRole('button', { name: '캘린더 일정 가져오기', exact: true }).click();
      const calendar = page.getByRole('dialog', { name: '캘린더 일정 가져오기', exact: true });
      await expect(calendar.getByRole('article')).toContainText('오늘 약속');
      await calendar.getByRole('button',{name:'오늘 약속 완료',exact:true}).click();
      await expect(calendar.getByRole('button',{name:'오늘 약속 완료 취소',exact:true})).toBeVisible();
      await expect(calendar.getByRole('article').locator('p').first()).toHaveClass(/line-through/);
      await calendar.getByRole('button',{name:'오늘 약속 완료 취소',exact:true}).click();
      await expect(calendar.getByRole('button',{name:'오늘 약속 완료',exact:true})).toBeVisible();
      expect(await calendar.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await calendar.getByRole('button', { name: '오늘 약속 일정 가져오기', exact: true }).click();
      await expect(calendar.getByRole('button', { name: '오늘 약속 일정 가져오기', exact: true })).toBeDisabled();
      const data = await page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await import(path)).exportAllData(); });
      expect(data.tasks).toHaveLength(1);
      expect(data.tasks[0]).toMatchObject({ title: '오늘 약속', priority: 'high', memo: '준비물', linkedScheduleId: 'today-event' });
      expect(data.schedules).toHaveLength(1);
      await page.evaluate(async () => {
        const path = '/src/db/indexedDB.ts'; const db = await import(path);
        const task = (await db.getAllTasks())[0];
        await db.saveTask({ ...task, status: 'done', memo: '편집한 메모' });
        const schedule = (await db.getAllSchedules())[0];
        await Promise.all([db.saveCalendarTask(schedule), db.saveCalendarTask(schedule)]);
      });
      const saved = await page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await import(path)).getAllTasks(); });
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ status: 'done', memo: '편집한 메모' });
      const concurrent = await page.evaluate(async () => {
        const path = '/src/db/indexedDB.ts'; const db = await import(path);
        const source = (await db.getAllSchedules())[0];
        const inserted = await Promise.all([db.saveCalendarTask({ ...source, id: 'concurrent' }), db.saveCalendarTask({ ...source, id: 'concurrent' })]);
        return { inserted, tasks: await db.getAllTasks() };
      });
      expect(concurrent.inserted.sort()).toEqual([false, true]);
      expect(concurrent.tasks).toHaveLength(2);
    });
  });
}
