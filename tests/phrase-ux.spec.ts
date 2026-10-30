import { presetMode } from './helpers/preset-actions';
import { chooseDate, readDate, expectDate } from './helpers/date';
import { test, expect, Page } from '@playwright/test';
import type { AppData } from '../src/types';
async function data(page: Page): Promise<AppData> {
  return page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await import(path)).exportAllData(); });
}
async function open(page: Page) {
  await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  return page.getByRole('dialog', { name: '새 일정', exact: true });
}
async function seed(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const dialog = await open(page); await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await page.evaluate(async () => {
    const path = '/src/db/indexedDB.ts'; const db = await import(path);
    await db.importAllData({
      categories: [{ id: 'a', name: '개인', color: '#112233', sortOrder: 0 }, { id: 'b', name: '업무', color: '#445566', sortOrder: 1 }],
      schedules: [{ id: 'old', title: '기존 반복 일정', date: '2026-10-28', category: 'a', memo: '기존 메모', completed: false, recurrenceRuleId: 'rule' }],
      recurrenceRules: [{ id: 'rule', scheduleId: 'old', frequency: 'weekly', startDate: '2026-10-28' }],
      recurrenceExceptions: [{ id: 'exception', ruleId: 'rule', originalDate: '2026-11-04', action: 'modified', modifiedSchedule: { category: 'a', title: '반복 수정' } }],
      presets: ['집중 업무', '운동', '주간 회의'].map((text, i) => ({ id: 'p' + i, text, type: 'title', sortOrder: i, isFavorite: i < 2, usageCount: i, lastUsedAt: i * 100, createdAt: 1, updatedAt: 1 })),
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded' }); return open(page);
}
const panel = (page: Page) => page.locator('[data-schedule-panel]:visible, [data-inline-presets]:visible');
async function categories(page: Page) {
  await page.getByRole('button', { name: '카테고리 선택', exact: true }).click();
  await page.getByRole('button', { name: '카테고리 관리', exact: true }).click(); return panel(page);
}
test.beforeEach(async ({ page }) => { await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort()); });

test('프리셋 선택·검색·복구·이어 붙이기·현재 제목 저장과 다른 필드 보존', async ({ page }) => {
  const dialog = await seed(page), title = dialog.getByLabel('일정 제목', { exact: true });
  await title.fill('작성하던 제목'); await chooseDate(dialog, '일정 날짜', '2026-10-30');
  await dialog.getByRole('checkbox', { name: '종일 (시간 없음)' }).uncheck();
  await setTime(dialog, '시작 시간', '11:10'); await setTime(dialog, '종료 시간', '12:20');
  await dialog.getByRole('button', { name: '+ 상세 옵션 (메모)', exact: true }).click(); await dialog.getByPlaceholder('상세 내용을 메모하세요').fill('작성하던 메모');
  await dialog.getByRole('button', { name: '프리셋', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(panel(page).getByRole('group', {name:'프리셋 그룹 선택'})).toBeVisible();

  await presetMode(dialog,'replace'); await panel(page).getByLabel('프리셋 검색', { exact: true }).fill('회의');
  await panel(page).getByRole('button', { name: '주간 회의', exact: true }).click(); await panel(page).getByRole('button',{name:'프리셋 패널 닫기'}).click();
  await expect(title).toHaveValue('주간 회의');
  await dialog.getByRole('button', { name: '이전 제목 복구', exact: true }).click(); await expect(title).toHaveValue('작성하던 제목');
  await dialog.getByRole('button', {name:'프리셋',exact:true}).click(); await presetMode(dialog,'append'); await panel(page).getByLabel('프리셋 검색', { exact: true }).fill('');
  await panel(page).getByRole('button', { name: '운동', exact: true }).click(); await panel(page).getByRole('button',{name:'프리셋 패널 닫기'}).click(); await expect(title).toHaveValue('작성하던 제목 운동');
  await dialog.getByRole('button', { name: '프리셋으로 저장', exact: true }).click(); await expect(dialog.getByRole('status', { name: '프리셋 알림', exact: true })).toContainText('저장했습니다');
  await dialog.getByRole('button', { name: '프리셋으로 저장', exact: true }).click(); await expect(dialog.getByRole('status', { name: '프리셋 알림', exact: true })).toContainText('이미 저장');
  await expectDate(dialog, '일정 날짜', '2026-10-30'); await expectTime(dialog, '시작 시간', '11:10');
  await expect(dialog.getByPlaceholder('상세 내용을 메모하세요')).toHaveValue('작성하던 메모');
  await dialog.getByRole('button', { name: '등록', exact: true }).click(); await expect(dialog).toHaveCount(0);
  const stored = await data(page); expect(stored.schedules.find(s => s.title === '작성하던 제목 운동')).toMatchObject({ date: '2026-10-30', startTime: '11:10', endTime: '12:20', memo: '작성하던 메모', category: '' });
  expect(stored.schedules.find(s => s.id === 'old')?.recurrenceRuleId).toBe('rule');
});

test('카테고리 생성·선택·수정·색상·순서·취소·삭제 및 참조 보존', async ({ page }) => {
  const dialog = await seed(page); await dialog.getByLabel('일정 제목', { exact: true }).fill('카테고리 초안');
  let manager = await categories(page);
  await manager.getByPlaceholder('카테고리 이름').fill('새 분류'); await manager.getByLabel('카테고리 색상').fill('#abcdef'); await manager.getByRole('button', { name: '추가', exact: true }).click();
  await expect(panel(page)).toHaveCount(0); await expect(dialog.getByRole('button', { name: '카테고리 선택', exact: true })).toContainText('새 분류');
  await expect(dialog.getByLabel('일정 제목', { exact: true })).toHaveValue('카테고리 초안');
  manager = await categories(page); const row = manager.locator('[data-category-id=a]');
  await row.getByRole('button', { name: '수정', exact: true }).click(); await expect(manager.getByPlaceholder('카테고리 이름')).toHaveValue('개인');
  await manager.getByPlaceholder('카테고리 이름').fill('취소할 이름'); await manager.getByRole('button', { name: '취소', exact: true }).click(); await manager.getByRole('button', { name: '등록 취소', exact: true }).click(); expect((await data(page)).categories.find(c => c.id === 'a')?.name).toBe('개인');
  await row.getByRole('button', { name: '수정', exact: true }).click(); await manager.getByPlaceholder('카테고리 이름').fill('생활'); await manager.getByLabel('카테고리 색상').fill('#fedcba'); await manager.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await expect(row).toContainText('생활'); expect((await data(page)).categories.find(c => c.id === 'a')).toMatchObject({ name: '생활', color: '#fedcba' });
  await row.getByRole('button', { name: '카테고리 아래로 이동', exact: true }).click(); await expect(manager.getByRole('listitem').first()).toHaveAttribute('data-category-id', 'b');
  await row.getByRole('button', { name: '삭제', exact: true }).click(); await expect(row).toContainText('일정 1개');
  await row.getByRole('group', { name: '카테고리 삭제 확인' }).getByRole('button', { name: '삭제', exact: true }).click(); await expect(row).toHaveCount(0);
  const result = await data(page); expect(result.schedules.find(s => s.id === 'old')).toMatchObject({ category: '', title: '기존 반복 일정', recurrenceRuleId: 'rule' });
  expect(result.recurrenceExceptions[0].modifiedSchedule).toMatchObject({ category: '', title: '반복 수정' }); expect(result.recurrenceRules).toHaveLength(1);
  await page.reload({ waitUntil: 'domcontentloaded' }); await open(page); expect((await data(page)).categories.some(c => c.id === 'a')).toBe(false);
});

test('등록창·프리셋·카테고리 각각 20회 반복, Escape·뒤로가기·포커스·스크롤 복구', async ({ page }) => {
  await seed(page); await page.keyboard.press('Escape');
  const trigger = page.getByRole('button', { name: '일정 등록', exact: true });
  for (let i = 0; i < 20; i++) {
    const dialog = await open(page); await expect(page.locator('[data-schedule-overlay]')).toHaveCount(1);
    await expect(page.locator('[data-schedule-overlay]')).toHaveCSS('background-color', 'rgba(45, 35, 40, 0.25)');
    await dialog.getByRole('button', { name: '일정 등록창 닫기', exact: true }).click(); await expect(page.locator('[data-schedule-overlay]')).toHaveCount(0);
    await expect(trigger).toBeFocused(); expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  }
  const dialog = await open(page); await dialog.getByLabel('일정 제목', { exact: true }).fill('반복 사용 초안');
  for (let i = 0; i < 20; i++) {
    await dialog.getByRole('button', { name: '프리셋', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(1); await expect(page.locator('[data-schedule-overlay]')).toHaveCSS('background-color', 'rgba(45, 35, 40, 0.25)');
    await page.keyboard.press('Escape'); await expect(panel(page)).toHaveCount(0);
    await dialog.getByRole('button', { name: '카테고리 선택', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(1); await page.keyboard.press('Escape'); await expect(panel(page)).toHaveCount(0);
  }
  await dialog.getByRole('button', { name: '프리셋', exact: true }).click(); await panel(page).getByRole('button', { name: '프리셋 관리', exact: true }).click(); await panel(page).getByRole('button', { name: '뒤로', exact: true }).first().click(); await panel(page).getByRole('button', { name: '프리셋 패널 닫기', exact: true }).click();
  await categories(page); await page.goBack(); await expect(panel(page).getByRole('button', { name: '카테고리 관리', exact: true })).toBeVisible(); await page.goBack(); await expect(panel(page)).toHaveCount(0); await expect(dialog.getByLabel('일정 제목', { exact: true })).toHaveValue('반복 사용 초안');
  await page.goBack(); await expect(dialog.getByRole('alert', { name: '등록 취소 확인' })).toBeVisible(); await dialog.getByRole('button', { name: '등록 취소', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('카테고리 삭제 실패는 원자적으로 복구, 빈 목록·백업 왕복 보존', async ({ page }) => {
  await seed(page);
  await page.evaluate(async () => {
    const path = '/src/db/indexedDB.ts'; const db = await import(path); const before = await db.exportAllData();
    const remove = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (...args) { if (this.name === 'categories') throw new Error('삭제 실패 주입'); return remove.apply(this, args); };
    let failed = false; try { await db.deleteCategory('a'); } catch { failed = true; } finally { IDBObjectStore.prototype.delete = remove; }
    if (!failed || JSON.stringify(await db.exportAllData()) !== JSON.stringify(before)) throw new Error('원자성 실패');
    await db.deleteCategory('a'); await db.deleteCategory('b');
  });
  await page.reload({ waitUntil: 'domcontentloaded' }); await open(page); expect((await data(page)).categories).toEqual([]);
  const manager = await categories(page); await manager.getByPlaceholder('카테고리 이름').fill('빈 목록에서 추가'); await manager.getByRole('button', { name: '추가', exact: true }).click(); await expect(panel(page)).toHaveCount(0);
  const before = await data(page); await page.evaluate(async backup => { const path = '/src/db/indexedDB.ts'; await (await import(path)).importAllData(JSON.parse(backup)); }, JSON.stringify(before));
  await page.reload({ waitUntil: 'domcontentloaded' }); await open(page); expect(await data(page)).toEqual(before);
});

test('모바일 긴 프리셋 전체 확인, 작은 화면 저장 버튼·한국어 조합 보호', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 }); const dialog = await seed(page), title = dialog.getByLabel('일정 제목', { exact: true });
  const long = '모바일에서 긴 프리셋의 전체 내용을 확인합니다. '.repeat(8).trim(); await title.fill(long);
  await dialog.getByRole('button', { name: '프리셋으로 저장', exact: true }).click(); await expect(dialog.getByRole('status', { name: '프리셋 알림', exact: true })).toContainText('저장했습니다');
  await dialog.getByRole('button', { name: '프리셋', exact: true }).click(); await panel(page).getByLabel('프리셋 검색', { exact: true }).fill('모바일에서');
  const item = panel(page).getByRole('button', { name: long, exact: true }); await expect(item).toHaveCSS('white-space', 'normal'); await item.click(); await panel(page).getByRole('button',{name:'프리셋 패널 닫기'}).click();
  await title.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, keyCode: 229 }); await expect(dialog).toBeVisible();
  await page.setViewportSize({ width: 390, height: 420 }); await title.fill('모바일 최종 일정');
  const save = dialog.getByRole('button', { name: '등록', exact: true }); await expect(save).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/minially-mobile.png' }); await save.click(); await expect(dialog).toHaveCount(0);
});

test('전체 앱: 제목만 저장·수정·검색·날짜 복사·이동·삭제와 새로고침', async ({ page }) => {
  const dialog = await seed(page);
  await dialog.getByLabel('일정 제목', { exact: true }).fill('전체 흐름 일정');
  await page.screenshot({ path: 'test-results/minially-desktop.png' });
  const initialDate = await readDate(dialog, '일정 날짜');
  await dialog.getByRole('button', { name: '등록', exact: true }).click(); await expect(dialog).toHaveCount(0);
  const row = () => page.locator('[draggable=true]').filter({ has: page.getByTitle('수정', { exact: true }) }).filter({ hasText: '전체 흐름 일정' });
  await row().hover(); await row().getByTitle('수정', { exact: true }).click();
  const edit = page.getByRole('dialog', { name: '일정 수정', exact: true }); await edit.getByLabel('일정 제목', { exact: true }).fill('전체 흐름 일정 수정'); await edit.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await expect(edit).toHaveCount(0);
  await page.getByRole('button', { name: '일정 검색', exact: true }).click(); await page.getByPlaceholder('일정 제목, 메모, 카테고리 검색...').fill('전체 흐름 일정 수정'); await expect(page.getByText('1건', { exact: true })).toBeVisible(); await page.getByText('닫기', { exact: true }).click();
  await page.getByTitle('이 날짜 일정 전체 복사', { exact: true }).click(); await page.getByRole('button', { name: '복사', exact: true }).click();
  await expect.poll(async () => (await data(page)).schedules.filter(s => s.title === '전체 흐름 일정 수정').length).toBe(2);
  await row().hover(); await row().getByTitle('이동/복사', { exact: true }).click();
  await chooseDate(page, '대상 날짜', '2026-12-31'); await page.getByRole('button', { name: '이동', exact: true }).click();
  await expect.poll(async () => (await data(page)).schedules.find(s => s.title === '전체 흐름 일정 수정' && s.date === '2026-12-31')?.date).toBe('2026-12-31');
  expect((await data(page)).schedules.filter(s => s.title === '전체 흐름 일정 수정' && s.date === initialDate)).toHaveLength(0);
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: '일정 검색', exact: true }).click(); await page.getByPlaceholder('일정 제목, 메모, 카테고리 검색...').fill('전체 흐름 일정 수정'); await expect(page.getByText('2건', { exact: true })).toBeVisible();
  await page.getByText('전체 흐름 일정 수정', { exact: true }).last().click(); const deleting = page.getByRole('dialog', { name: '일정 수정', exact: true }); await deleting.getByTitle('일정 삭제', { exact: true }).click(); await deleting.getByRole('group', { name: '일정 삭제 확인' }).getByRole('button', { name: '삭제', exact: true }).click(); await expect(deleting).toHaveCount(0);
  await expect.poll(async () => (await data(page)).schedules.filter(s => s.title === '전체 흐름 일정 수정').length).toBe(1);
});

async function setTime(scope: ReturnType<Page['getByRole']>, label: string, value: string) {
  const [hour, minute] = value.split(':');
  await scope.getByLabel(label + ' 시', { exact: true }).selectOption(hour);
  await scope.getByLabel(label + ' 분', { exact: true }).selectOption(minute);
}
async function expectTime(scope: ReturnType<Page['getByRole']>, label: string, value: string) {
  const [hour, minute] = value.split(':');
  await expect(scope.getByLabel(label + ' 시', { exact: true })).toHaveValue(hour);
  await expect(scope.getByLabel(label + ' 분', { exact: true })).toHaveValue(minute);
}
