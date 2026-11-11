import { test, expect, Page } from '@playwright/test';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
async function data(page: Page) { return page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await import(path)).exportAllData(); }); }
test.beforeEach(async ({ page }) => { await page.route('**/fonts.googleapis.com/**', r => r.abort()); await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor(); });

test('카테고리가 하나도 없어도 간편·상세 등록이 되고 미분류로 저장', async ({ page }) => {
  expect((await data(page)).categories).toEqual([]);
  await page.locator(`[data-calendar-date="${today()}"]`).click({ position: { x: 5, y: 5 } });
  const sheet = page.getByRole('dialog', { name: '날짜별 일정', exact: true });
  await sheet.getByRole('button', { name: '일정 등록하기', exact: true }).click();
  const title = sheet.getByLabel('빠른 일정 제목', { exact: true });
  await expect(title).toBeVisible(); // 카테고리가 없으면 고르는 단계를 건너뛴다
  await title.fill('카테고리 없는 간편 일정'); await title.press('Enter'); await expect(title).toHaveValue('');
  await sheet.getByRole('button', { name: '간편 등록 닫기', exact: true }).click();
  await expect(sheet.getByRole('region', { name: '미분류', exact: true })).toContainText('카테고리 없는 간편 일정');
  await sheet.getByRole('button', { name: '날짜 팝업 닫기' }).click();
  await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정', exact: true });
  await editor.getByLabel('일정 제목', { exact: true }).fill('카테고리 없는 상세 일정');
  await editor.getByRole('button', { name: '등록', exact: true }).click(); await expect(editor).toHaveCount(0);
  const stored = await data(page);
  expect(stored.schedules.map((s: any) => [s.title, s.category]).sort()).toEqual([['카테고리 없는 간편 일정', ''], ['카테고리 없는 상세 일정', '']]);
  expect(stored.categories).toEqual([]);
});

test('카테고리가 1개뿐이고 일정이 쓰고 있어도 삭제되고 일정은 미분류', async ({ page }) => {
  await page.evaluate(async date => { const path = '/src/db/indexedDB.ts'; const db = await import(path); await db.saveCategory({ id: 'only', name: '하나뿐', color: '#CF8FA8' }); await db.saveSchedule({ id: 's', title: '분류된 일정', date, category: 'only', completed: false }); }, today());
  await page.reload(); await page.getByRole('button', { name: '카테고리', exact: true }).click();
  const row = page.locator('[data-category-id="only"]');
  await row.getByRole('button', { name: '삭제', exact: true }).click();
  const confirm = row.getByRole('group', { name: '카테고리 삭제 확인' });
  await expect(confirm).toContainText('일정 1개는 미분류가 됩니다');
  await confirm.getByRole('button', { name: '삭제', exact: true }).click(); await expect(row).toHaveCount(0);
  const stored = await data(page); expect(stored.categories).toEqual([]); expect(stored.schedules[0]).toMatchObject({ id: 's', category: '' });
});

test('캘린더의 같이 보기 전환으로 공유 일정 켜고 끄기, 설정의 단축키 도움말', async ({ page }) => {
  await page.route('**/api/shared', route => route.fulfill({ json: { name: '민호', schedules: [{ id: 'x', title: '공유 받은 약속', date: today(), category: 'c', completed: false }], recurrenceRules: [], recurrenceExceptions: [], categories: [{ id: 'c', name: '약속', color: '#94BED9' }], tasks: [] } }));
  await page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; const db = await import(path); await db.saveAppSettings({ ...(await db.getAppSettings()), sharedViews: [{ id: 'v1', code: 'AAAABBBBCCCCDDDD', label: '민호', color: '#7FA7C9', visible: true }] }); });
  await page.reload(); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  const toggle = page.getByRole('group', { name: '같이 보기 전환' }).getByRole('button', { name: '민호' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.calendar-view').getByText('공유 받은 약속').first()).toBeVisible();
  await toggle.click(); await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.calendar-view').getByText('공유 받은 약속')).toHaveCount(0);
  await page.reload(); await expect(toggle).toHaveAttribute('aria-pressed', 'false'); // 끈 상태 유지
  await toggle.click(); await expect(page.locator('.calendar-view').getByText('공유 받은 약속').first()).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 }); await expect(toggle).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: 'test-results/shared-toggle-360.png' }); await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: '설정 및 프리셋' }).click();
  await page.getByRole('dialog', { name: '설정', exact: true }).getByRole('button', { name: '단축키 도움말' }).click();
  await expect(page.getByRole('dialog', { name: '단축키', exact: true })).toContainText('새 일정');
  await expect(page.getByRole('dialog', { name: '설정', exact: true })).toHaveCount(0);
});
