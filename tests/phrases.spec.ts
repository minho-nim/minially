import { presetAction, presetMode } from './helpers/preset-actions';
import { chooseDate, readDate, expectDate } from './helpers/date';
import { test, expect, Page } from '@playwright/test';
import type { AppData, Preset } from '../src/types';

test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
});

async function openSchedule(page: Page) {
  await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  return page.getByRole('dialog', { name: '새 일정', exact: true });
}
async function openPhrases(page: Page) {
  const schedule = page.getByRole('dialog', { name: '새 일정', exact: true });
  if (!(await schedule.locator('[data-inline-presets]').isVisible())) await schedule.getByRole('button', { name: '프리셋', exact: true }).click();
  await schedule.getByRole('button', { name: '프리셋 관리', exact: true }).click();
  return schedule.locator('[data-schedule-panel]');
}
async function usePhrase(page: Page, text: string) {
  const schedule = page.getByRole('dialog', { name: '새 일정', exact: true }); const manager = schedule.locator('[data-schedule-panel]');
  if (await manager.isVisible()) await manager.getByRole('button', { name: '뒤로', exact: true }).first().click();
  const selection = schedule.locator('[data-inline-presets]'); if (!(await selection.isVisible())) await schedule.getByRole('button', { name: '프리셋', exact: true }).click();
  await presetMode(schedule,'replace'); await selection.getByRole('button', { name: text, exact: true }).click(); await selection.getByRole('button',{name:'프리셋 패널 닫기'}).click();
}
async function readData(page: Page): Promise<AppData> {
  return page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await import(path)).exportAllData(); });
}
async function addPhrase(modal: ReturnType<Page['getByRole']>, text: string) {
  if (!(await modal.getByLabel('새 프리셋', { exact: true }).isVisible())) await modal.getByRole('button', { name: '새 프리셋 추가', exact: true }).click();
  await modal.getByLabel('새 프리셋', { exact: true }).fill(text);
  await modal.getByRole('button', { name: '프리셋 저장', exact: true }).click();
  await expect(modal.getByText(text, { exact: true })).toBeVisible();
}

// A new browser context per test isolates all data from the user's browser.
test('요청한 12단계: 프리셋 CRUD, 새로고침, 일정 연동, 백업과 복원', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  let schedule = await openSchedule(page);
  let modal = await openPhrases(page);
  const original = await readData(page);
  await addPhrase(modal, '테스트 주간 회의'); // 1–2
  const added = (await readData(page)).presets.find(p => p.text === '테스트 주간 회의')!;
  expect(added).toMatchObject({ isFavorite: false, usageCount: 0 });
  expect(added.createdAt).toBeGreaterThan(0);
  const row = modal.locator(`[data-phrase-id="${added.id}"]`);
  await row.getByRole('button', { name: '프리셋 수정', exact: true }).click();
  await expect(row.getByLabel('프리셋 수정 내용')).toHaveValue('테스트 주간 회의');
  await row.getByLabel('프리셋 수정 내용').fill('수정한 주간 회의');
  await row.getByRole('button', { name: '변경사항 저장' }).click(); // 3–4
  await expect(row.getByText('수정한 주간 회의', { exact: true })).toBeVisible();
  let data = await readData(page);
  expect(data.presets.length).toBe(original.presets.length + 1);
  expect(data.presets.find(p => p.id === added.id)!.text).toBe('수정한 주간 회의');
  for (const prior of original.presets) expect(data.presets.find(p => p.id === prior.id)).toEqual(prior);
  await addPhrase(modal, '삭제용 프리셋');
  const deleteRow = modal.locator('li').filter({ has: page.getByText('삭제용 프리셋', { exact: true }) });
  await presetAction(deleteRow,'프리셋 삭제');
  await deleteRow.getByRole('button', { name: '취소', exact: true }).click();
  await expect(deleteRow).toBeVisible();
  await presetAction(deleteRow,'프리셋 삭제');
  await deleteRow.getByRole('button', { name: '삭제', exact: true }).click(); // 5
  await expect(deleteRow).toHaveCount(0);
  await page.reload({ waitUntil: 'domcontentloaded' }); // 6
  schedule = await openSchedule(page);
  await chooseDate(schedule, '일정 날짜', '2026-10-29');
  await schedule.getByRole('button', { name: '+ 상세 옵션 (메모)', exact: true }).click();
  await schedule.getByRole('checkbox', { name: '종일 (시간 없음)' }).uncheck();
  await setTime(schedule, '시작 시간', '14:15');
  await setTime(schedule, '종료 시간', '15:45');
  await schedule.getByPlaceholder('상세 내용을 메모하세요').fill('기존 메모');
  modal = await openPhrases(page);
  await usePhrase(page, '수정한 주간 회의'); // 7
  await expect(modal).toHaveCount(0);
  await expect(schedule.getByPlaceholder('일정 제목을 입력하세요')).toHaveValue('수정한 주간 회의');
  await expectDate(schedule, '일정 날짜', '2026-10-29');
  await expectTime(schedule, '시작 시간', '14:15');
  await expectTime(schedule, '종료 시간', '15:45');
  await expect(schedule.getByPlaceholder('상세 내용을 메모하세요')).toHaveValue('기존 메모');
  await schedule.getByPlaceholder('일정 제목을 입력하세요').fill('수정한 주간 회의 — 자료 검토'); // 8
  await schedule.getByRole('button', { name: '등록', exact: true }).click(); // 9
  await expect(schedule).toHaveCount(0);
  await expect(page.getByText('수정한 주간 회의 — 자료 검토', { exact: true }).first()).toBeVisible(); // 10
  data = await readData(page);
  const saved = data.schedules.find(s => s.title === '수정한 주간 회의 — 자료 검토')!;
  expect(saved).toMatchObject({ date: '2026-10-29', startTime: '14:15', endTime: '15:45', memo: '기존 메모' });
  expect(data.presets.find(p => p.id === added.id)!.usageCount).toBe(1);
  await openSchedule(page);
  modal = await openPhrases(page);
  const edited = modal.locator(`[data-phrase-id="${added.id}"]`);
  await edited.getByRole('button', { name: '프리셋 수정', exact: true }).click();
  await edited.getByLabel('프리셋 수정 내용').fill('프리셋만 다시 변경');
  await edited.getByRole('button', { name: '변경사항 저장' }).click();
  await expect(edited.getByText('프리셋만 다시 변경', { exact: true })).toBeVisible();
  expect((await readData(page)).schedules.find(s => s.id === saved.id)).toEqual(saved); // 11
  await modal.getByRole('button', { name: '뒤로', exact: true }).first().click();
  await page.getByRole('dialog', { name: '새 일정', exact: true }).getByRole('button', { name: '취소', exact: true }).click();
  await page.locator('header').getByRole('button', { name: '설정 및 프리셋' }).click();
  await page.getByRole('button', { name: '백업/복원', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /JSON 백업 다운로드/ }).click();
  const download = await downloadPromise;
  const fs = await import('node:fs/promises');
  const backup = await fs.readFile((await download.path())!, 'utf8');
  expect((JSON.parse(backup) as AppData).presets.find(p => p.id === added.id)!.text).toBe('프리셋만 다시 변경');
  await page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; await (await import(path)).deletePreset((await (await import(path)).getAllPresets()).find((p: Preset) => p.text === '프리셋만 다시 변경').id); });
  page.once('dialog', dialog => dialog.accept());
  await page.locator('input[type="file"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await expect(page.getByRole('dialog', { name: '설정', exact: true }).getByRole('status')).toHaveText('백업을 복원했습니다.');
  expect((await readData(page)).presets).toEqual(JSON.parse(backup).presets);
  expect((await readData(page)).schedules).toEqual(JSON.parse(backup).schedules); // 12
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect((await readData(page)).schedules.find(s => s.id === saved.id)).toEqual(saved);
  expect(errors).toEqual([]);
});

test('즐겨찾기·지정 순서·사용 순서와 빈 목록 유지', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await openSchedule(page);
  let modal = await openPhrases(page);
  await addPhrase(modal, '순서 A');
  await addPhrase(modal, '순서 B');
  let data = await readData(page);
  const a = data.presets.find(p => p.text === '순서 A')!;
  const b = data.presets.find(p => p.text === '순서 B')!;
  const rowB = modal.locator(`[data-phrase-id="${b.id}"]`);
  await presetAction(rowB,'위로 이동');
  await expect.poll(async () => { const list = (await readData(page)).presets; return list.find(p => p.id === b.id)!.order! < list.find(p => p.id === a.id)!.order!; }).toBe(true);
  await rowB.getByRole('button', { name: '즐겨찾기 등록', exact: true }).click();
  await expect(rowB.getByRole('button', { name: '즐겨찾기 해제', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await usePhrase(page, '순서 B');
  modal = await openPhrases(page);
  await modal.getByText('보기 설정 · 즐겨찾기 / 정렬',{exact:true}).click(); await modal.getByLabel('프리셋 정렬').selectOption('usage');
  await expect(modal.locator('li').first()).toHaveAttribute('data-phrase-id', b.id);
  await page.reload({ waitUntil: 'domcontentloaded' });
  data = await readData(page);
  expect(data.presets.find(p => p.id === b.id)).toMatchObject({ isFavorite: true, usageCount: 1 });
  expect(data.presets.find(p => p.id === b.id)!.order).toBeLessThan(data.presets.find(p => p.id === a.id)!.order!);
  await page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; const db = await import(path); await db.importAllData({ presets: [], schedules: [] }); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openSchedule(page);
  modal = await openPhrases(page);
  await expect(modal.getByText('저장된 프리셋이 없습니다. 새 프리셋을 추가해 보세요.')).toBeVisible();
  expect((await readData(page)).schedules).toEqual([]);
  await addPhrase(modal, '빈 목록에서 추가');
});

test('비동기 저장 실패 시 프리셋 초안과 기존 데이터 유지', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await openSchedule(page);
  const modal = await openPhrases(page);
  const before = await readData(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as any).restorePut = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'presets') throw new DOMException('Storage full', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await modal.getByRole('button', { name: '새 프리셋 추가', exact: true }).click();
  await modal.getByLabel('새 프리셋', { exact: true }).fill('실패해도 남는 초안');
  await modal.getByRole('button', { name: '프리셋 저장', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('다시 시도');
  await expect(modal.getByLabel('새 프리셋', { exact: true })).toHaveValue('실패해도 남는 초안');
  expect((await readData(page)).presets).toEqual(before.presets);
  await page.evaluate(() => (window as any).restorePut());
  await modal.getByRole('button', { name: '프리셋 저장', exact: true }).click();
  await expect(modal.getByText('실패해도 남는 초안', { exact: true })).toBeVisible();
});

test('이전 프리셋 데이터 이관 및 잘못된 백업의 원자적 롤백', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('legacy-seeded')) {
      localStorage.setItem('DAYFLOW_APP_DATA_V1', JSON.stringify({ presets: [{ id: 'legacy', defaultTitle: '예전 제목', memo: '예전 메모', isFavorite: true }] }));
      localStorage.setItem('legacy-seeded', 'true');
    }
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await openSchedule(page);
  const before = await readData(page);
  expect(before.presets.find(p => p.id === 'legacy')).toMatchObject({ text: '예전 제목', isFavorite: true, usageCount: 0 });
  expect(before.presets.find(p => p.id === 'legacy-memo')!.text).toBe('예전 메모');
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect((await readData(page)).presets).toEqual(before.presets);
  const result = await page.evaluate(async () => {
    const path = '/src/db/indexedDB.ts'; const db = await import(path);
    try { await db.importAllData({ presets: [], schedules: [{ id: 'bad', title: 'bad', date: () => {} }] }); return 'unexpected success'; }
    catch { return 'failed'; }
  });
  expect(result).toBe('failed');
  expect((await readData(page)).presets).toEqual(before.presets);
  expect((await readData(page)).schedules).toEqual(before.schedules);
});

test('모바일 설정 관리, 프리셋 관리·삭제 실패와 재시도, 메모 선택', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('header').getByRole('button', { name: '설정 및 프리셋' }).click();
  await page.getByRole('button', { name: '새 프리셋 추가', exact: true }).click();
  await page.getByLabel('새 프리셋', { exact: true }).fill('모바일 설정 프리셋');
  await page.getByRole('button', { name: '프리셋 저장', exact: true }).click();
  await expect(page.getByText('모바일 설정 프리셋', { exact: true })).toBeVisible();
  const phrase = (await readData(page)).presets.find(p => p.text === '모바일 설정 프리셋')!;
  const row = page.locator(`[data-phrase-id="${phrase.id}"]`);
  await row.getByRole('button', { name: '프리셋 수정', exact: true }).click();
  await row.getByLabel('프리셋 수정 내용').fill('모바일 수정 프리셋');
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    const remove = IDBObjectStore.prototype.delete;
    (window as any).restoreWrites = () => { IDBObjectStore.prototype.put = put; IDBObjectStore.prototype.delete = remove; };
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'presets') throw new DOMException('Failed', 'QuotaExceededError');
      return put.apply(this, args);
    };
    IDBObjectStore.prototype.delete = function (...args: Parameters<IDBObjectStore['delete']>) {
      if (this.name === 'presets') throw new DOMException('Failed', 'UnknownError');
      return remove.apply(this, args);
    };
  });
  await row.getByRole('button', { name: '변경사항 저장' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(row.getByLabel('프리셋 수정 내용')).toHaveValue('모바일 수정 프리셋');
  expect((await readData(page)).presets.find(p => p.id === phrase.id)!.text).toBe('모바일 설정 프리셋');
  await page.evaluate(() => (window as any).restoreWrites());
  await row.getByRole('button', { name: '변경사항 저장' }).click();
  await expect(row.getByText('모바일 수정 프리셋', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-phrases.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await presetAction(row,'프리셋 삭제');
  await row.getByRole('button', { name: '취소', exact: true }).click();
  await expect(row).toBeVisible();
  await presetAction(row,'프리셋 삭제');
  await page.evaluate(() => {
    const remove = IDBObjectStore.prototype.delete;
    (window as any).restoreDelete = () => { IDBObjectStore.prototype.delete = remove; };
    IDBObjectStore.prototype.delete = function (...args: Parameters<IDBObjectStore['delete']>) {
      if (this.name === 'presets') throw new DOMException('Failed', 'UnknownError');
      return remove.apply(this, args);
    };
  });
  await row.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(row).toBeVisible();
  await page.evaluate(() => (window as any).restoreDelete());
  await row.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  const schedule = page.getByRole('dialog', { name: '새 일정', exact: true });
  await schedule.getByPlaceholder('일정 제목을 입력하세요').fill('메모 연동 일정');
  await schedule.getByRole('button', { name: '+ 상세 옵션 (메모)', exact: true }).click();
  await schedule.getByPlaceholder('상세 내용을 메모하세요').fill('직접 적은 메모');
  await schedule.getByRole('button', { name: '저장된 메모', exact: true }).click();
  let modal = schedule.locator('[data-schedule-panel]');
  await addPhrase(modal, '추가 메모 프리셋');
  await modal.getByRole('button', { name: '추가 메모 프리셋', exact: true }).click();
  await expect(schedule.getByPlaceholder('일정 제목을 입력하세요')).toHaveValue('메모 연동 일정');
  await expect(schedule.getByPlaceholder('상세 내용을 메모하세요')).toHaveValue('직접 적은 메모\n추가 메모 프리셋');
  await schedule.getByRole('button', { name: '프리셋', exact: true }).click();
  modal = schedule.locator('[data-inline-presets]');
  await expect(modal).toBeVisible(); await expect(schedule.getByLabel('일정 제목', { exact: true })).toHaveValue('메모 연동 일정');
});

test('빈 첫 실행과 기존 일정·프리셋 전체 보존', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await openSchedule(page);
  let data = await readData(page);
  expect(data.schedules).toEqual([]);
  expect(data.tasks).toEqual([]);
  expect(data.presets).toEqual([]);
  await page.evaluate(async () => {
    const path = '/src/db/indexedDB.ts';
    const db = await import(path);
    await db.importAllData({
      schedules: [
        { id: 'sample-1', title: '주간 업무 우선순위 정하기', date: '2026-10-28', startTime: '09:30', endTime: '10:00', category: 'work', completed: false, memo: '이번 주 주요 릴리스 마일스톤 점검' },
        { id: 'sample-2', title: '사용자가 수정한 일정', date: '2026-10-28', category: 'work', completed: false },
        { id: 'user-schedule', title: '내 일정', date: '2026-10-28', category: 'personal', completed: false },
      ],
      tasks: [
        { id: 'sample-task-2', title: '비타민 및 영양제 구매', dueDate: '2026-10-30', status: 'todo', priority: 'medium', checklist: [], memo: '오메가3, 비타민D' },
        { id: 'user-task', title: '내 할 일', status: 'todo', priority: 'high' },
      ],
      presets: [
        { id: 'phrase-title-1', type: 'title', text: '주간 팀 회의 및 업무 공유', isFavorite: true, usageCount: 0, createdAt: 1710000000000, updatedAt: 1710000000000, order: 1 },
        { id: 'phrase-title-2', type: 'title', text: '내가 고친 프리셋', isFavorite: false, usageCount: 0, createdAt: 1710000000000, updatedAt: 1710000000001, order: 2 },
        { id: 'user-phrase', type: 'title', text: '내 프리셋', isFavorite: false, usageCount: 0, createdAt: 1710000000000, updatedAt: 1710000000000 },
      ],
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openSchedule(page);
  data = await readData(page);
  expect(data.schedules.map(s => s.id)).toEqual(['sample-1', 'sample-2', 'user-schedule']);
  expect(data.tasks.map(t => t.id)).toEqual(['sample-task-2', 'user-task']);
  expect(data.presets.map(p => p.id)).toEqual(['phrase-title-1', 'phrase-title-2', 'user-phrase']);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openSchedule(page);
  expect(await readData(page)).toEqual(data);
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
