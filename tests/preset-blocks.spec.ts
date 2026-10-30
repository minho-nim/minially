import { chooseDate, readDate, expectDate } from './helpers/date';
import { test, expect, Page } from '@playwright/test';
import type { AppData } from '../src/types';
async function data(page: Page): Promise<AppData> { return page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await import(path)).exportAllData(); }); }
async function seed(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; await (await import(path)).importAllData({ presets: ['회의', '준비', '검토'].map((text, i) => ({ id: 'block-' + i, text, type: 'title', sortOrder: i, isFavorite: false, usageCount: 0, createdAt: 1, updatedAt: 1 })) }); });
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
}
const picker = (page: Page) => page.locator('[data-schedule-panel]:visible, [data-preset-content]:visible');
async function choose(page: Page, text: string) { const item = picker(page).getByRole('list', { name: '프리셋 목록', exact: true }).getByRole('button', { name: text, exact: true }); if ((page.viewportSize()?.width ?? 1280) < 768) await item.tap(); else await item.click(); }
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => { const errors: string[] = []; browserErrors.set(page, errors); page.on('pageerror', e => errors.push(e.message)); await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.abort()); });
test.afterEach(async ({ page }) => { expect(browserErrors.get(page)).toEqual([]); });

test('등록 진입 하나, 카테고리 미선택·직접 추가, 09~10시·5분 선택과 등록 취소', async ({ page }) => {
  await seed(page); await expect(page.getByRole('button', { name: '일정 등록', exact: true })).toHaveCount(1); await expect(page.locator('header').getByRole('button', { name: '등록', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: '새 일정 등록', exact: true })).toHaveCount(0); await expect(page.getByPlaceholder('+ 새 일정 입력 후 Enter')).toHaveCount(0);
  await page.getByRole('button', { name: '일정 등록', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '새 일정', exact: true });
  await expect(dialog.getByRole('checkbox', { name: '종일 (시간 없음)' })).not.toBeChecked(); await expect(dialog.getByLabel('시작 시간 시', { exact: true })).toHaveValue('09'); await expect(dialog.getByLabel('종료 시간 시', { exact: true })).toHaveValue('10'); await expect(dialog.getByRole('button', { name: '카테고리 선택', exact: true })).toContainText('선택하세요');
  expect(await dialog.getByLabel('시작 시간 분', { exact: true }).locator('option').evaluateAll(items => items.map(e => (e as HTMLOptionElement).value))).toEqual(['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']);
  await dialog.getByLabel('일정 제목', { exact: true }).fill('다섯 분 일정'); await dialog.getByLabel('시작 시간 분', { exact: true }).selectOption('05'); await dialog.getByLabel('종료 시간 분', { exact: true }).selectOption('10');
  await dialog.getByRole('button', { name: '카테고리 선택', exact: true }).click(); await picker(page).getByRole('button', { name: '새 카테고리 추가', exact: true }).click(); await picker(page).getByPlaceholder('카테고리 이름').fill('새 분류'); await picker(page).getByRole('button', { name: '추가', exact: true }).click(); await expect(dialog.getByRole('button', { name: '카테고리 선택', exact: true })).toContainText('새 분류');
  await dialog.getByRole('button', { name: '취소', exact: true }).click(); await expect(dialog.getByRole('button', { name: '등록 취소', exact: true })).toBeVisible(); await expect(dialog.getByText('변경사항 버리기', { exact: true })).toHaveCount(0); await dialog.getByRole('button', { name: '계속 작성', exact: true }).click(); await dialog.getByRole('button', { name: '등록', exact: true }).click(); await expect(dialog).toHaveCount(0);
  const stored = await data(page); expect(stored.schedules[0]).toMatchObject({ title: '다섯 분 일정', startTime: '09:05', endTime: '10:10', category: stored.categories.find(c => c.name === '새 분류')!.id });
});

test('기존 묶음 프리셋을 일정에서 재사용·드래그·재편집', async ({ page }) => {
  await seed(page); await page.evaluate(async()=>{const path='/src/db/indexedDB.ts';await(await import(path)).savePreset({id:'legacy-bundle',text:'준비 회의 완료',blocks:['준비','회의','완료'].map((text,i)=>({id:'b'+i,text})),type:'title',isFavorite:false,usageCount:0,sortOrder:4,createdAt:1,updatedAt:1});});await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button', { name: '일정 등록', exact: true }).click(); let edit = page.getByRole('dialog', { name: '새 일정', exact: true }); await edit.getByRole('button', { name: '프리셋', exact: true }).click(); const bundle = edit.locator('[data-inline-preset]').filter({ hasText: '준비 회의 완료' }); await bundle.click(); await edit.getByRole('button',{name:'프리셋 패널 닫기'}).click(); await edit.getByRole('button', { name: '등록', exact: true }).click(); await expect(edit).toHaveCount(0);
  let stored = await data(page); const schedule = stored.schedules[0]; expect(schedule).toMatchObject({ title: '준비 회의 완료', startTime: '09:00', endTime: '10:00', category: '' }); expect(schedule.titleBlocks?.map(b => b.text)).toEqual(['준비', '회의', '완료']);
  const row = page.locator('[draggable=true]').filter({ has: page.getByTitle('수정', { exact: true }) }).filter({ hasText: '준비 회의 완료' }); await row.hover(); await row.getByTitle('수정', { exact: true }).click(); edit = page.getByRole('dialog', { name: '일정 수정', exact: true }); await edit.getByRole('button', { name: '회의 블록 이동', exact: true }).focus(); await page.keyboard.press('ArrowLeft'); await expect(edit.getByLabel('일정 제목', { exact: true })).toHaveValue('회의 준비 완료'); await edit.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await expect(edit).toHaveCount(0); stored = await data(page); expect(stored.schedules[0].id).toBe(schedule.id); expect(stored.schedules[0].title).toBe('회의 준비 완료');
  const before = await data(page); await page.evaluate(async backup => { const path = '/src/db/indexedDB.ts'; await (await import(path)).importAllData(JSON.parse(backup)); }, JSON.stringify(before)); await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: '프리셋', exact: true }).waitFor(); expect(await data(page)).toEqual(before);
});

test('저장 프리셋 드래그 정렬·키보드 이동·새로고침 유지', async ({ page }) => {
  await seed(page); await page.getByRole('button', { name: '프리셋', exact: true }).click();  const list = picker(page).getByRole('list', { name: '프리셋 목록', exact: true });
  await list.getByRole('button', { name: '회의 프리셋 위치 이동', exact: true }).dragTo(list.locator('[data-phrase-id="block-2"]')); await expect.poll(async () => list.locator('li').evaluateAll(items => items.map(e => e.getAttribute('data-phrase-id')))).toEqual(['block-1', 'block-2', 'block-0']);
  await list.getByRole('button', { name: '회의 프리셋 위치 이동', exact: true }).focus(); await page.keyboard.press('ArrowUp'); await expect.poll(async () => list.locator('li').evaluateAll(items => items.map(e => e.getAttribute('data-phrase-id')))).toEqual(['block-1', 'block-0', 'block-2']);
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: '프리셋', exact: true }).click();  await expect.poll(async () => picker(page).getByRole('list', { name: '프리셋 목록', exact: true }).locator('li').evaluateAll(items => items.map(e => e.getAttribute('data-phrase-id')))).toEqual(['block-1', 'block-0', 'block-2']);
});

test('기존 1분 단위 일정은 열기·메모 수정만으로 반올림하지 않음', async ({ page }) => {
  await seed(page); await page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; const db = await import(path); await db.saveSchedule({ id: 'legacy-minute', title: '예전 시간', date: '2026-10-28', startTime: '09:02', endTime: '10:03', category: 'personal', completed: false, memo: '원래 메모' }); }); await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: '일정 검색', exact: true }).click(); const search = page.getByRole('dialog', { name: '일정 검색', exact: true }); await search.getByLabel('일정 검색어', { exact: true }).fill('예전 시간'); await search.getByRole('button', { name: /예전 시간/ }).click(); const edit = page.getByRole('dialog', { name: '일정 수정', exact: true }); await expect(edit.getByLabel('시작 시간 분', { exact: true })).toHaveValue('02'); await expect(edit.getByLabel('종료 시간 분', { exact: true })).toHaveValue('03'); await edit.getByPlaceholder('상세 내용을 메모하세요').fill('메모만 수정'); await edit.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await expect(edit).toHaveCount(0); expect((await data(page)).schedules[0]).toMatchObject({ id: 'legacy-minute', startTime: '09:02', endTime: '10:03', memo: '메모만 수정' });
});

test.describe('모바일 블록', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('실제 터치 드래그로 저장된 프리셋 목록의 순서 변경', async ({ page }) => {
    await seed(page); await page.getByRole('button', { name: '프리셋', exact: true }).tap();
    const touchDrag = async (source: ReturnType<Page['getByRole']>, target: ReturnType<Page['getByRole']>) => {
      await source.scrollIntoViewIfNeeded(); const a = await source.boundingBox(), b = await target.boundingBox(); if (!a || !b) throw new Error('드래그 위치 없음'); const cdp = await page.context().newCDPSession(page); const x = a.x + a.width / 2, y = a.y + a.height / 2, tx = b.x + b.width / 2, ty = b.y + b.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (tx - x) * i / 8, y: y + (ty - y) * i / 8, id: 1 }] }); await page.waitForTimeout(16); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
    };
    const list = picker(page).getByRole('list', { name: '프리셋 목록', exact: true }); await touchDrag(list.getByRole('button', { name: '회의 프리셋 위치 이동', exact: true }), list.locator('[data-phrase-id="block-1"]')); await expect.poll(async () => list.locator('li').evaluateAll(items => items.map(e => e.getAttribute('data-phrase-id')))).toEqual(['block-1', 'block-0', 'block-2']); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: 'test-results/preset-blocks-mobile.png' });
  });
});

test('날짜와 시간은 선택만 가능, 달력 Escape·뒤로가기와 날짜 선택 후 등록', async ({ page }) => {
  await seed(page); await page.getByRole('button', { name: '일정 등록', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '새 일정', exact: true });
  await expect(dialog.locator('input[type="date"], input[type="time"], input[type="number"]')).toHaveCount(0);
  await dialog.getByRole('button', { name: '일정 날짜', exact: true }).click(); await expect(dialog.getByRole('group', { name: '일정 날짜 달력', exact: true })).toBeVisible(); await page.keyboard.press('Escape'); await expect(dialog.getByRole('group', { name: '일정 날짜 달력', exact: true })).toHaveCount(0); await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '일정 날짜', exact: true }).click(); await page.goBack(); await expect(dialog.getByRole('group', { name: '일정 날짜 달력', exact: true })).toHaveCount(0); await expect(dialog).toBeVisible();
  await chooseDate(dialog, '일정 날짜', '2026-12-31'); await expectDate(dialog, '일정 날짜', '2026-12-31'); await dialog.getByLabel('일정 제목', { exact: true }).fill('선택으로 등록'); await dialog.getByLabel('시작 시간 분', { exact: true }).selectOption('05'); await dialog.getByRole('button', { name: '등록', exact: true }).click(); await expect(dialog).toHaveCount(0); expect((await data(page)).schedules[0]).toMatchObject({ title: '선택으로 등록', date: '2026-12-31', startTime: '09:05', endTime: '10:00' });
});

test('할 일 날짜도 선택 전용이며 달력 Escape·뒤로가기·바깥 클릭 후 초안 유지', async ({ page }) => {
  await seed(page); await page.locator('header').getByRole('button', { name: '할 일', exact: true }).click(); const title = page.getByPlaceholder('+ 새로운 할 일 입력 후 Enter'); await title.fill('할 일 날짜 선택');
  await page.getByRole('group',{name:'할 일 등록 구분'}).getByRole('button',{name:'예정',exact:true}).click(); const button = page.getByRole('button', { name: '할 일 날짜', exact: true }), calendar = page.getByRole('group', { name: '할 일 날짜 달력', exact: true });
  await button.click(); await expect(calendar).toBeVisible(); await page.keyboard.press('Escape'); await expect(calendar).toHaveCount(0); await expect(title).toHaveValue('할 일 날짜 선택');
  await button.click(); await page.goBack(); await expect(calendar).toHaveCount(0); await expect(title).toHaveValue('할 일 날짜 선택');
  await button.click(); await title.click(); await expect(calendar).toHaveCount(0); await chooseDate(page, '할 일 날짜', '2026-12-31'); await page.getByRole('button', { name: '추가', exact: true }).click(); await expect.poll(async () => (await data(page)).tasks.length).toBe(1); expect((await data(page)).tasks[0]).toMatchObject({ title: '할 일 날짜 선택', dueDate: '2026-12-31' });
});
