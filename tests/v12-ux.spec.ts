import { chooseDate, readDate, expectDate } from './helpers/date';
import { test, expect, Page } from '@playwright/test';
import type { AppData } from '../src/types';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const list: string[] = []; errors.set(page, list); page.on('pageerror', e => list.push(e.message));
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });
async function open(page: Page) {
  await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  return page.getByRole('dialog', { name: '새 일정', exact: true });
}
async function data(page: Page): Promise<AppData> { return page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await import(path)).exportAllData(); }); }
async function failHistory(page: Page) {
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; (window as any).restoreHistory = () => { IDBObjectStore.prototype.put = put; }; IDBObjectStore.prototype.put = function (...args) { if (this.name === 'changeHistory') throw new DOMException('Full', 'QuotaExceededError'); return put.apply(this, args); }; });
}
const row = (page: Page, text: string) => page.locator('[draggable=true]').filter({ has: page.getByTitle('수정', { exact: true }) }).filter({ hasText: text });

test('빈 초안 즉시 닫기, 변경한 초안의 계속 작성·버리기, 다시 열기 초기화', async ({ page }) => {
  let dialog = await open(page); await expect(dialog.getByLabel('일정 제목', { exact: true })).toBeFocused(); await dialog.getByRole('button', { name: '취소', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(page.getByText('등록을 취소할까요?', { exact: true })).toHaveCount(0);
  dialog = await open(page); await dialog.getByLabel('일정 제목', { exact: true }).fill('아직 저장하지 않은 제목'); await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await dialog.getByRole('button', { name: '계속 작성', exact: true }).click(); await expect(dialog.getByLabel('일정 제목', { exact: true })).toHaveValue('아직 저장하지 않은 제목');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(1); await dialog.getByRole('button', { name: '등록 취소', exact: true }).click(); await expect(dialog).toHaveCount(0);
  dialog = await open(page); await expect(dialog.getByLabel('일정 제목', { exact: true })).toHaveValue(''); expect((await data(page)).schedules).toHaveLength(0);
});

test('연속 등록 성공 후 닫기 명칭과 중복 클릭 방지, 저장 오류 원자성 및 재시도', async ({ page }) => {
  const dialog = await open(page); await dialog.getByRole('checkbox', { name: '계속 등록', exact: true }).check(); await dialog.getByLabel('일정 제목', { exact: true }).fill('연속 등록 일정');
  await dialog.getByRole('button', { name: '등록 후 계속', exact: true }).click(); await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeVisible(); await expect(dialog.getByLabel('일정 제목', { exact: true })).toHaveValue('');
  await dialog.getByRole('button', { name: '닫기', exact: true }).click(); await expect(dialog).toHaveCount(0);
  const next = await open(page); await next.getByLabel('일정 제목', { exact: true }).fill('실패 후 재등록'); await failHistory(page);
  await next.getByRole('button', { name: '등록', exact: true }).click(); await expect(next.getByRole('alert')).toContainText('저장하지 못'); expect((await data(page)).schedules.filter(s => s.title === '실패 후 재등록')).toHaveLength(0);
  await expect(next.getByLabel('일정 제목', { exact: true })).toHaveValue('실패 후 재등록');
  await page.evaluate(() => (window as any).restoreHistory()); await next.getByRole('button', { name: '등록', exact: true }).dblclick(); await expect(next).toHaveCount(0);
  expect((await data(page)).schedules.filter(s => s.title === '실패 후 재등록')).toHaveLength(1);
});

test('프리셋·카테고리·설정의 미저장 변경 보호와 즐겨찾기·최근 사용 중복 방지', async ({ page }) => {
  let dialog = await open(page); await dialog.getByLabel('일정 제목', { exact: true }).fill('유지할 일정 초안'); await dialog.getByRole('button', { name: '프리셋', exact: true }).click();
  await dialog.getByRole('button', { name: '프리셋 관리', exact: true }).click();
  const panel = page.locator('[data-schedule-panel]'); await panel.getByRole('button', { name: '새 프리셋 추가', exact: true }).click(); await panel.getByLabel('새 프리셋', { exact: true }).fill('저장하지 않은 프리셋');
  await panel.getByRole('button', { name: '뒤로', exact: true }).click(); await dialog.getByRole('button', { name: '계속 작성', exact: true }).click(); await expect(panel.getByLabel('새 프리셋', { exact: true })).toHaveValue('저장하지 않은 프리셋');
  await panel.getByRole('button', { name: '뒤로', exact: true }).click(); await dialog.getByRole('button', { name: '등록 취소', exact: true }).click(); await expect(panel).toHaveCount(0); await expect(dialog.getByLabel('일정 제목', { exact: true })).toHaveValue('유지할 일정 초안');
  await dialog.getByRole('button', { name: '카테고리 선택', exact: true }).click(); await panel.getByRole('button', { name: '카테고리 관리', exact: true }).click(); await panel.getByPlaceholder('카테고리 이름').fill('분류 초안'); await panel.getByRole('button', { name: '뒤로', exact: true }).click(); await dialog.getByRole('button', { name: '등록 취소', exact: true }).click(); await expect(panel.getByRole('button', { name: '카테고리 관리', exact: true })).toBeVisible(); await panel.getByRole('button', { name: '뒤로', exact: true }).click();
  await dialog.getByRole('button', { name: '취소', exact: true }).click(); await dialog.getByRole('button', { name: '등록 취소', exact: true }).click();
  await page.getByRole('button', { name: '설정 및 프리셋', exact: true }).click(); const settings = page.getByRole('dialog', { name: '설정', exact: true }); await settings.getByRole('button', { name: '새 프리셋 추가', exact: true }).click(); await settings.getByLabel('새 프리셋', { exact: true }).fill('설정 초안'); await settings.getByRole('button', { name: '카테고리', exact: true }).click(); await settings.getByRole('button', { name: '계속 작성', exact: true }).click(); await expect(settings.getByLabel('새 프리셋', { exact: true })).toHaveValue('설정 초안'); await settings.getByRole('button', { name: '프리셋 저장', exact: true }).click(); await settings.getByRole('button', { name: '설정 닫기', exact: true }).click();
  dialog = await open(page); await dialog.getByRole('button', { name: '프리셋', exact: true }).click(); const selection = dialog.locator('[data-inline-presets]'); await selection.getByRole('button', { name: '설정 초안', exact: true }).click(); await selection.getByRole('button',{name:'프리셋 패널 닫기'}).click(); await dialog.getByRole('button', { name: '프리셋', exact: true }).click(); await selection.getByRole('button', { name: '프리셋 관리', exact: true }).click(); const item = panel.locator('[data-phrase-id]').filter({ hasText: '설정 초안' }); await item.getByRole('button', { name: '즐겨찾기 등록', exact: true }).click(); await panel.getByRole('button', { name: '뒤로', exact: true }).first().click();
  await expect(selection.getByRole('button', { name: '설정 초안', exact: true })).toHaveCount(1); expect((await data(page)).presets[0]).toMatchObject({isFavorite:true,usageCount:1});
  expect((await data(page)).presets).toHaveLength(1);
});

test('여러 날짜 선택에서 제목·시간·메모 보존 후 일괄 등록, 종료 시간 검증', async ({ page }) => {
  const dialog = await open(page); await dialog.getByLabel('일정 제목', { exact: true }).fill('여러 날짜 일정'); const date = await readDate(dialog, '일정 날짜');
  await dialog.getByRole('checkbox', { name: '종일 (시간 없음)' }).uncheck(); await setTime(dialog, '시작 시간', '14:30'); await setTime(dialog, '종료 시간', '13:30');
  await dialog.getByRole('button', { name: '등록', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('종료 시간'); await setTime(dialog, '종료 시간', '15:30');
  await dialog.getByRole('button', { name: '+ 상세 옵션 (메모)', exact: true }).click(); await dialog.getByPlaceholder('상세 내용을 메모하세요').fill('날짜를 바꿔도 유지');
  await dialog.getByRole('button', { name: '여러 날짜 선택', exact: true }).click(); const panel = page.locator('[data-schedule-panel]'); await panel.getByRole('button', { name: '직접 선택', exact: true }).click(); const calendar=panel.getByRole('group',{name:'직접 선택 달력'}); await calendar.getByLabel('직접 선택 연도',{exact:true}).selectOption('2026'); await calendar.getByLabel('직접 선택 월',{exact:true}).selectOption('12'); await calendar.getByRole('button',{name:'2026-12-31 선택',exact:true}).click(); await calendar.getByRole('button',{name:'직접 선택 달력 닫기'}).click(); await panel.getByRole('button', { name: '뒤로', exact: true }).click();
  await expect(dialog.getByLabel('일정 제목', { exact: true })).toHaveValue('여러 날짜 일정'); await expect(dialog.getByPlaceholder('상세 내용을 메모하세요')).toHaveValue('날짜를 바꿔도 유지');
  await dialog.getByRole('button', { name: '2개 등록', exact: true }).click(); await expect(dialog).toHaveCount(0);
  const items = (await data(page)).schedules; expect(items.map(s => s.date).sort()).toEqual([date, '2026-12-31'].sort()); for (const item of items) expect(item).toMatchObject({ title: '여러 날짜 일정', startTime: '14:30', endTime: '15:30', memo: '날짜를 바꿔도 유지' });
});

test('삭제 확인·실행 취소, 완료 반영, 검색 편집 후 검색어와 이전 화면 복귀', async ({ page }) => {
  const dialog = await open(page); await dialog.getByLabel('일정 제목', { exact: true }).fill('삭제 복구 일정'); await dialog.getByRole('button', { name: '등록', exact: true }).click(); await expect(dialog).toHaveCount(0); const before = (await data(page)).schedules;
  await row(page, '삭제 복구 일정').getByRole('button', { name: '일정 완료', exact: true }).click(); await expect(row(page, '삭제 복구 일정').getByRole('button', { name: '일정 완료 해제', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await row(page, '삭제 복구 일정').hover(); await row(page, '삭제 복구 일정').getByTitle('삭제', { exact: true }).click(); const confirmation = page.getByRole('dialog', { name: '일정 삭제 확인', exact: true }); await confirmation.getByRole('button', { name: '취소', exact: true }).click(); expect((await data(page)).schedules).toHaveLength(1);
  await row(page, '삭제 복구 일정').getByTitle('삭제', { exact: true }).click(); await confirmation.getByRole('button', { name: '삭제', exact: true }).click(); await expect(confirmation).toHaveCount(0); await expect.poll(async () => (await data(page)).schedules.length).toBe(0); await page.getByRole('button', { name: '실행 취소', exact: true }).click(); await expect.poll(async () => (await data(page)).schedules.length).toBe(1); expect((await data(page)).schedules[0]).toMatchObject({ id: before[0].id, completed: true });
  await page.getByRole('button', { name: '일정 검색', exact: true }).click(); const search = page.getByRole('dialog', { name: '일정 검색', exact: true }); await search.getByLabel('일정 검색어', { exact: true }).fill('삭제 복구'); await search.getByRole('button', { name: /삭제 복구 일정/ }).click();
  const edit = page.getByRole('dialog', { name: '일정 수정', exact: true }); await edit.getByRole('button', { name: '취소', exact: true }).click(); await expect(search).toBeVisible(); await expect(search.getByLabel('일정 검색어', { exact: true })).toHaveValue('삭제 복구'); await expect(page.getByRole('dialog')).toHaveCount(1); await search.getByRole('button', { name: '검색어 지우기', exact: true }).click(); await expect(search.getByLabel('일정 검색어', { exact: true })).toHaveValue(''); await search.getByRole('button', { name: '닫기', exact: true }).click();
  await page.locator('header').getByRole('button', { name: '할 일', exact: true }).click(); await page.getByPlaceholder('+ 새로운 할 일 입력 후 Enter').fill('할 일 삭제 복구'); await page.getByRole('button', { name: '추가', exact: true }).click(); await expect(page.getByText('할 일 삭제 복구', { exact: true })).toBeVisible(); await page.getByTitle('삭제', { exact: true }).click(); const taskConfirm = page.getByRole('dialog', { name: '할 일 삭제 확인', exact: true }); await taskConfirm.getByRole('button', { name: '삭제', exact: true }).click(); await expect(taskConfirm).toHaveCount(0); await expect.poll(async () => (await data(page)).tasks.length).toBe(0); await page.getByRole('button', { name: '실행 취소', exact: true }).click(); await expect.poll(async () => (await data(page)).tasks.length).toBe(1);
});

test('복사·이동 저장 실패 시 열린 화면과 선택 날짜 유지, 재시도 후 닫기', async ({ page }) => {
  const dialog = await open(page); await dialog.getByLabel('일정 제목', { exact: true }).fill('복사 이동 실패 검증'); await dialog.getByRole('button', { name: '등록', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await page.getByTitle('이 날짜 일정 전체 복사', { exact: true }).click(); const copy = page.getByRole('dialog', { name: '일정 복사', exact: true }); await failHistory(page); await copy.getByRole('button', { name: '복사', exact: true }).click(); await expect(copy.getByRole('alert')).toContainText('복사하지 못'); expect((await data(page)).schedules).toHaveLength(1); await page.evaluate(() => (window as any).restoreHistory()); await copy.getByRole('button', { name: '복사', exact: true }).click(); await expect(copy).toHaveCount(0); expect((await data(page)).schedules).toHaveLength(2);
  await row(page, '복사 이동 실패 검증').hover(); await row(page, '복사 이동 실패 검증').getByTitle('이동/복사', { exact: true }).click(); const move = page.getByRole('dialog', { name: '일정 이동 / 복사', exact: true }); await chooseDate(move, '대상 날짜', '2026-12-31'); await failHistory(page); await move.getByRole('button', { name: '이동', exact: true }).click(); await expect(move.getByRole('alert')).toContainText('저장하지 못'); await expectDate(move, '대상 날짜', '2026-12-31'); expect((await data(page)).schedules.some(s => s.date === '2026-12-31')).toBe(false); await page.evaluate(() => (window as any).restoreHistory()); await move.getByRole('button', { name: '이동', exact: true }).click(); await expect(move).toHaveCount(0); expect((await data(page)).schedules.some(s => s.date === '2026-12-31')).toBe(true);
});

test('320px 화면·줄어든 키보드 영역·포커스 순환·월 이동의 선택 날짜', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 680 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  let dialog = await open(page); await dialog.getByLabel('일정 제목', { exact: true }).fill('모바일 제목'); await page.setViewportSize({ width: 320, height: 380 }); const save = dialog.getByRole('button', { name: '등록', exact: true }); await expect(save).toBeInViewport(); await save.focus(); await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: '일정 등록창 닫기', exact: true })).toBeFocused();
  await page.screenshot({ path: 'test-results/v12-mobile.png' }); await save.click(); await expect(dialog).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 }); await page.getByTitle('다음', { exact: true }).click(); dialog = await open(page); const selected = await readDate(dialog, '일정 날짜'); expect(Number(selected.slice(5, 7))).toBe(11); await dialog.getByRole('button', { name: '취소', exact: true }).click(); await expect(dialog).toHaveCount(0); await page.screenshot({ path: 'test-results/v12-desktop.png' });
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
