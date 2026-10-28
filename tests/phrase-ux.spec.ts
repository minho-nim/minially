import { test, expect, Page } from '@playwright/test';
import type { AppData } from '../src/types';

const fixtures = [
  { id: 'favorite-a', text: '집중 업무', isFavorite: true, order: 0, usageCount: 2, lastUsedAt: 10 },
  { id: 'favorite-b', text: '운동', isFavorite: true, order: 1, usageCount: 1, lastUsedAt: 20 },
  { id: 'recent-a', text: '주간 회의', isFavorite: false, order: 2, usageCount: 7, lastUsedAt: 100 },
  { id: 'recent-b', text: '장보기', isFavorite: false, order: 3, usageCount: 1, lastUsedAt: 50 },
  { id: 'unused', text: '독서 계획', isFavorite: false, order: 4, usageCount: 0, lastUsedAt: 0 },
];

async function data(page: Page): Promise<AppData> {
  return page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await import(path)).exportAllData(); });
}
async function open(page: Page) {
  const desktop = page.locator('header').getByRole('button', { name: '등록', exact: true });
  if (await desktop.isVisible()) await desktop.click();
  else await page.getByRole('button', { name: '새 일정 등록', exact: true }).click();
  return page.getByRole('dialog', { name: '새 일정', exact: true });
}
async function seed(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await open(page);
  await page.evaluate(async presets => {
    const path = '/src/db/indexedDB.ts';
    await (await import(path)).importAllData({
      presets: presets.map(p => ({ ...p, type: 'title', createdAt: 1700000000000, updatedAt: 1700000000001 })),
      schedules: [{ id: 'old-event', title: '기존 일정 보존', date: '2026-10-28', category: 'personal', completed: false }],
    });
  }, fixtures);
  await page.reload({ waitUntil: 'domcontentloaded' });
  return open(page);
}

test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
});

test('빠른 문구 3개, 교체·복구·이어 붙이기, 현재 제목 저장과 실제 일정 등록', async ({ page }) => {
  const schedule = await seed(page);
  const quick = schedule.getByRole('region', { name: '자주 쓰는 문구 빠른 선택' });
  const title = schedule.getByLabel('일정 제목', { exact: true });
  const chips = quick.locator('button[title]');
  await expect(chips).toHaveText(['집중 업무', '운동', '주간 회의']);
  await expect(chips).toHaveCount(3);
  await title.fill('원래 입력한 제목');
  await schedule.locator('input[type="date"]').fill('2026-10-30');
  await schedule.getByRole('button', { name: '+ 추가 옵션 (시간, 카테고리, 메모)', exact: true }).click();
  await schedule.getByRole('checkbox', { name: '종일 (시간 없음)' }).uncheck();
  await schedule.locator('input[type="time"]').nth(0).fill('11:10');
  await schedule.locator('input[type="time"]').nth(1).fill('12:20');
  await schedule.getByRole('button', { name: '개인', exact: true }).click();
  await schedule.getByPlaceholder('상세 내용을 메모하세요').fill('기존 메모');
  await title.focus();
  await quick.getByRole('button', { name: '집중 업무', exact: true }).click();
  await expect(title).toHaveValue('집중 업무');
  await expect(title).toBeFocused();
  await expect(schedule).toBeVisible();
  await expect(page.getByRole('dialog', { name: '자주 쓰는 문구', exact: true })).toHaveCount(0);
  await expect.poll(async () => (await data(page)).presets.find(p => p.id === 'favorite-a')!.usageCount).toBe(3);
  await expect(schedule.locator('input[type="date"]')).toHaveValue('2026-10-30');
  await expect(schedule.locator('input[type="time"]').nth(0)).toHaveValue('11:10');
  await expect(schedule.locator('input[type="time"]').nth(1)).toHaveValue('12:20');
  await expect(schedule.getByPlaceholder('상세 내용을 메모하세요')).toHaveValue('기존 메모');
  await quick.getByRole('button', { name: '이전 제목 복구', exact: true }).click();
  await expect(title).toHaveValue('원래 입력한 제목');
  await quick.getByRole('button', { name: '이어 붙이기', exact: true }).click();
  await quick.getByRole('button', { name: '운동', exact: true }).click();
  await expect(title).toHaveValue('원래 입력한 제목 운동');
  await quick.getByRole('button', { name: '이전 제목 복구', exact: true }).click();
  await expect(title).toHaveValue('원래 입력한 제목');
  await quick.getByRole('button', { name: '교체', exact: true }).click();
  await quick.getByRole('button', { name: '주간 회의', exact: true }).click();
  await expect(title).toHaveValue('주간 회의');
  await title.fill('주간 회의 자료 검토');
  await quick.getByRole('button', { name: '자주 쓰는 문구로 저장', exact: true }).click();
  await expect(quick.getByRole('status').filter({ hasText: '현재 제목을 문구로 저장했습니다.' })).toBeVisible();
  const savedPhrase = (await data(page)).presets.find(p => p.text === '주간 회의 자료 검토')!;
  expect(savedPhrase.sortOrder).toBeGreaterThan(4);
  await quick.getByRole('button', { name: '자주 쓰는 문구로 저장', exact: true }).click();
  await expect(quick.getByText('이미 저장된 문구입니다.')).toBeVisible();
  expect((await data(page)).presets.filter(p => p.text === '주간 회의 자료 검토')).toHaveLength(1);
  await schedule.getByRole('button', { name: '저장', exact: true }).click();
  await expect(schedule).toHaveCount(0);
  let stored = await data(page);
  expect(stored.schedules.find(s => s.title === '주간 회의 자료 검토')).toMatchObject({ date: '2026-10-30', startTime: '11:10', endTime: '12:20', category: 'personal', memo: '기존 메모' });
  expect(stored.schedules.find(s => s.id === 'old-event')!.title).toBe('기존 일정 보존');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await open(page);
  stored = await data(page);
  expect(stored.presets.find(p => p.id === savedPhrase.id)!.text).toBe('주간 회의 자료 검토');
  expect(stored.presets.filter(p => fixtures.some(f => f.id === p.id))).toHaveLength(5);
  for (const fixture of fixtures) expect(stored.presets.find(p => p.id === fixture.id)!.sortOrder).toBe(fixture.order);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('전체 목록 검색·즐겨찾기·최근 사용·순서 및 동일 ID 편집·삭제 취소', async ({ page }) => {
  const schedule = await seed(page);
  await schedule.getByRole('button', { name: '더보기', exact: true }).click();
  let modal = page.getByRole('dialog', { name: '자주 쓰는 문구', exact: true });
  await expect(modal.getByRole('list', { name: '저장된 문구 목록' }).locator('li')).toHaveCount(5);
  await modal.getByLabel('문구 검색', { exact: true }).fill('회의');
  await expect(modal.getByRole('listitem')).toHaveCount(1);
  const row = modal.locator('[data-phrase-id="recent-a"]');
  await row.getByRole('button', { name: '즐겨찾기 등록', exact: true }).click();
  await expect(row.getByRole('button', { name: '즐겨찾기 해제', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await row.getByRole('button', { name: '즐겨찾기 해제', exact: true }).click();
  await expect(row.getByRole('button', { name: '즐겨찾기 등록', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await modal.getByLabel('문구 검색', { exact: true }).fill('없을 검색어');
  await expect(modal.getByText('조건에 맞는 문구가 없습니다.')).toBeVisible();
  await modal.getByRole('button', { name: '검색 지우기' }).click();
  await modal.getByLabel('문구 정렬').selectOption('recent');
  await expect(modal.getByRole('listitem').first()).toHaveAttribute('data-phrase-id', 'recent-a');
  await modal.getByRole('button', { name: '즐겨찾기만', exact: true }).click();
  await expect(modal.getByRole('listitem')).toHaveCount(2);
  await modal.getByRole('button', { name: '즐겨찾기만', exact: true }).click();
  await modal.getByLabel('문구 정렬').selectOption('manual');
  await modal.getByRole('button', { name: '문구 편집', exact: true }).click();
  await modal.locator('[data-phrase-id="favorite-b"]').getByRole('button', { name: '위로 이동' }).click();
  await expect(modal.getByRole('listitem').first()).toHaveAttribute('data-phrase-id', 'favorite-b');
  await row.getByRole('button', { name: '문구 수정', exact: true }).click();
  await expect(row.getByLabel('문구 수정 내용')).toHaveValue('주간 회의');
  await row.getByLabel('문구 수정 내용').fill('주간 회의 수정');
  await row.getByRole('button', { name: '저장하기' }).click();
  await expect(row.getByRole('button', { name: '주간 회의 수정', exact: true })).toBeVisible();
  expect((await data(page)).presets).toHaveLength(5);
  await row.getByRole('button', { name: '문구 삭제', exact: true }).click();
  await row.getByRole('button', { name: '취소', exact: true }).click();
  await expect(row).toBeVisible();
  await modal.getByLabel('새 문구 추가', { exact: true }).fill('팝업에서 추가');
  await modal.getByRole('button', { name: '새 문구 추가', exact: true }).click();
  const addedRow = modal.getByRole('listitem').filter({ has: page.getByRole('button', { name: '팝업에서 추가', exact: true }) });
  await expect(addedRow).toBeVisible();
  await addedRow.getByRole('button', { name: '문구 삭제', exact: true }).click();
  await addedRow.getByRole('button', { name: '삭제 확인', exact: true }).click();
  await expect(addedRow).toHaveCount(0);
  await row.getByRole('button', { name: '주간 회의 수정', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(schedule.getByLabel('일정 제목', { exact: true })).toHaveValue('주간 회의 수정');
  await schedule.getByRole('button', { name: '더보기', exact: true }).click();
  modal = page.getByRole('dialog', { name: '자주 쓰는 문구', exact: true });
  await expect(modal.locator('[data-phrase-id="recent-a"]').getByRole('button', { name: '주간 회의 수정', exact: true })).toBeVisible();
});

test.describe('모바일 입력', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('터치 문구 적용, 긴 문구 전체 확인, 한국어 조합 Enter, 즉시 일정 저장', async ({ page }) => {
    const schedule = await seed(page);
    const quick = schedule.getByRole('region', { name: '자주 쓰는 문구 빠른 선택' });
    const title = schedule.getByLabel('일정 제목', { exact: true });
    await title.fill('모바일 초안');
    await title.focus();
    await quick.getByRole('button', { name: '집중 업무', exact: true }).tap();
    await expect(title).toBeFocused();
    await expect(title).toHaveValue('집중 업무');
    await title.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, keyCode: 229 });
    await expect(schedule).toBeVisible();
    const longText = '긴 문구의 전체 내용을 선택 후 확인합니다. '.repeat(8).trim();
    await title.fill(longText);
    await quick.getByRole('button', { name: '자주 쓰는 문구로 저장', exact: true }).tap();
    await expect(quick.getByText('현재 제목을 문구로 저장했습니다.')).toBeVisible();
    await schedule.getByRole('button', { name: '더보기', exact: true }).tap();
    const modal = page.getByRole('dialog', { name: '자주 쓰는 문구', exact: true });
    await modal.getByLabel('문구 검색', { exact: true }).fill('긴 문구');
    await modal.getByRole('button', { name: longText, exact: true }).tap();
    await expect(title).toHaveValue(longText);
    await expect(quick.getByRole('status').filter({ hasText: '적용 문구:' })).toHaveText('적용 문구: ' + longText);
    await page.screenshot({ path: 'test-results/mobile-quick-phrases.png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await title.fill('모바일 최종 일정');
    await schedule.getByRole('button', { name: '저장', exact: true }).tap();
    await expect(schedule).toHaveCount(0);
    expect((await data(page)).schedules.some(s => s.title === '모바일 최종 일정')).toBe(true);
  });
});

test('구형 order 변환·사용 기록 동시 저장·JSON 왕복에서 ID와 데이터 유지', async ({ page }) => {
  await seed(page);
  const initial = await data(page);
  for (const fixture of fixtures) {
    const phrase = initial.presets.find(p => p.id === fixture.id)!;
    expect(phrase).toMatchObject({ text: fixture.text, sortOrder: fixture.order, order: fixture.order, createdAt: 1700000000000, updatedAt: 1700000000001, usageCount: fixture.usageCount });
  }
  await page.evaluate(async () => {
    const path = '/src/db/indexedDB.ts'; const db = await import(path);
    const stale = (await db.getAllPresets()).find((p: { id: string }) => p.id === 'favorite-a');
    await db.markPresetUsed(stale.id);
    await db.savePreset({ ...stale, text: '동시에 수정한 문구' });
  });
  const beforeBackup = await data(page);
  expect(beforeBackup.presets.find(p => p.id === 'favorite-a')).toMatchObject({ text: '동시에 수정한 문구', usageCount: 3, sortOrder: 0, createdAt: 1700000000000 });
  expect(beforeBackup.presets.find(p => p.id === 'favorite-a')!.lastUsedAt).toBeGreaterThan(100);
  const jsonBackup = JSON.stringify(beforeBackup);
  await page.evaluate(async backup => { const path = '/src/db/indexedDB.ts'; await (await import(path)).importAllData(JSON.parse(backup)); }, jsonBackup);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await open(page);
  expect(await data(page)).toEqual(beforeBackup);
});

test('현재 제목 저장 실패 재시도와 사용 기록 실패 시 즉시 적용·일정 저장', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const schedule = await seed(page);
  const quick = schedule.getByRole('region', { name: '자주 쓰는 문구 빠른 선택' });
  const title = schedule.getByLabel('일정 제목', { exact: true });
  const failWrites = () => page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    (window as any).restorePresetWrites = () => { IDBObjectStore.prototype.put = put; };
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'presets') throw new DOMException('Full', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await title.fill('현재 제목 저장 실패 초안');
  await failWrites();
  await quick.getByRole('button', { name: '자주 쓰는 문구로 저장', exact: true }).click();
  await expect(schedule.getByRole('alert')).toContainText('문구를 저장하지 못했습니다');
  await expect(title).toHaveValue('현재 제목 저장 실패 초안');
  expect((await data(page)).presets.some(p => p.text === '현재 제목 저장 실패 초안')).toBe(false);
  await page.evaluate(() => (window as any).restorePresetWrites());
  await quick.getByRole('button', { name: '자주 쓰는 문구로 저장', exact: true }).click();
  await expect(quick.getByText('현재 제목을 문구로 저장했습니다.')).toBeVisible();
  expect((await data(page)).presets.filter(p => p.text === '현재 제목 저장 실패 초안')).toHaveLength(1);
  await failWrites();
  await quick.getByRole('button', { name: '집중 업무', exact: true }).click();
  await expect(title).toHaveValue('집중 업무');
  await expect(schedule.getByRole('alert')).toContainText('제목은 적용됐지만');
  await schedule.getByRole('button', { name: '저장', exact: true }).click();
  await expect(schedule).toHaveCount(0);
  expect((await data(page)).schedules.some(s => s.title === '집중 업무')).toBe(true);
  expect(errors).toEqual([]);
  await page.evaluate(() => (window as any).restorePresetWrites());
});
