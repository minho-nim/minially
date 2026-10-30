import { presetMode } from './helpers/preset-actions';
import { test, expect, Page, Locator } from '@playwright/test';
import type { AppData } from '../src/types';
import { chooseDate } from './helpers/date';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const day = '2026-10-29';
const sheet = (page: Page) => page.getByRole('dialog', { name: '날짜별 일정', exact: true });
const rows = (page: Page) => sheet(page).locator('[data-day-schedule]');
const title = (page: Page) => sheet(page).getByRole('textbox', { name: '빠른 일정 제목', exact: true });
async function data(page: Page): Promise<AppData> { return page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await import(path)).exportAllData(); }); }
async function open(page: Page, date = day) { await page.locator(`[data-calendar-date="${date}"]`).click(); await expect(sheet(page)).toBeVisible(); return sheet(page); }
async function seed(page: Page, many = false) {
  await page.evaluate(async ({ day, many }) => {
    const path = '/src/db/indexedDB.ts'; const db = await import(path);
    await db.importAllData({ categories: [
      { id: 'a', name: '개인', color: '#CF8FA8', sortOrder: 1 }, { id: 'b', name: '업무', color: '#94BED9', sortOrder: 0 },
      { id: 'c', name: '학습', color: '#B4A2D3', sortOrder: 2 }, { id: 'd', name: '건강', color: '#9DB6A2', sortOrder: 3 },
    ], schedules: [
      { id: 'a1', title: '오후 개인', date: day, startTime: '14:00', category: 'a', completed: false },
      { id: 'b1', title: '오전 업무', date: day, startTime: '09:00', category: 'b', completed: false, isImportant: true },
      { id: 'b2', title: '같은 시간 업무', date: day, startTime: '09:00', category: 'b', completed: false },
      { id: 'c1', title: '학습 일정', date: day, startTime: '12:00', category: 'c', completed: false },
      { id: 'd1', title: '건강 일정', date: day, category: 'd', completed: false },
      { id: 'u1', title: '시간 없는 첫째', date: day, category: '', completed: false, sortOrder: 0 },
      { id: 'u2', title: '시간 없는 둘째', date: day, category: '', completed: false, sortOrder: 1 },
      ...(many ? Array.from({ length: 25 }, (_, i) => ({ id: 'more'+i, title: '긴 일정 '+i, date: day, category: '', completed: false })) : []),
    ], presets: [
      { id: 'p1', type: 'title', text: '집중 업무', isFavorite: true, lastUsedAt: 100, sortOrder: 0, usageCount: 1, createdAt: 1, updatedAt: 1 },
      { id: 'p2', type: 'title', text: '준비 회의', isFavorite: false, lastUsedAt: 100, sortOrder: 1, usageCount: 1, createdAt: 1, updatedAt: 1 },
      { id: 'p3', type: 'title', text: '긴 프리셋 문장을 모바일에서도 끝까지 읽고 선택하는 문구입니다', isFavorite: false, sortOrder: 2, usageCount: 0, createdAt: 1, updatedAt: 1 },
    ], recurrenceRules: [], recurrenceExceptions: [] });
  }, { day, many });
  await page.reload({ waitUntil: 'domcontentloaded' });
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  errors.set(page, []); page.on('pageerror', e => errors.get(page)!.push(e.message));
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: '일정 등록', exact: true })).toBeVisible();
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

test('신규 사용자 빈 카테고리, 부분 시트·보기 저장·카테고리 색상 및 중요 표시', async ({ page }) => {
  expect((await data(page)).categories).toEqual([]);
  await seed(page); const cell = page.locator(`[data-calendar-date="${day}"]`);
  await expect(cell.locator('.sm\\:hidden span[aria-label]')).toHaveCount(3);
  await expect(cell.getByText('+2', { exact: true })).toBeVisible(); await expect(cell.getByLabel('중요 일정 있음')).toBeVisible();
  const scrollBefore = await page.evaluate(() => scrollY); await open(page);
  expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
  const box = await sheet(page).locator('.day-sheet').boundingBox(); expect(box!.height).toBeGreaterThan(844 * .55); expect(box!.height).toBeLessThan(844 * .66);
  await expect(sheet(page).getByRole('region', { name: '업무', exact: true })).toBeVisible();
  expect(await sheet(page).locator('h3').allTextContents()).toEqual(['업무', '개인', '학습', '건강', '미분류']);
  await expect(rows(page).filter({ hasText: '오전 업무' }).locator('[data-schedule-title]')).toHaveCSS('font-weight', '700');
  await sheet(page).getByRole('button', { name: '목록형', exact: true }).click();
  expect(await rows(page).locator('[data-schedule-title]').allTextContents()).toEqual(['오전 업무', '같은 시간 업무', '학습 일정', '오후 개인', '건강 일정', '시간 없는 첫째', '시간 없는 둘째']);
  await sheet(page).getByRole('button', { name: '날짜 팝업 닫기' }).click(); await page.reload({ waitUntil: 'domcontentloaded' }); await open(page);
  await expect(sheet(page).getByRole('button', { name: '목록형', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(sheet(page).locator('h3')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/v13-mobile-list.png' });
});

test('Enter 연속 등록·한글 IME·중복 Enter·중요 초기화·저장 오류와 재시도', async ({ page }) => {
  await open(page); await sheet(page).getByRole('button', { name: '일정 추가', exact: true }).click();
  await title(page).fill('한글 조합중'); await title(page).dispatchEvent('compositionstart'); await title(page).press('Enter'); expect((await data(page)).schedules).toHaveLength(0); await title(page).dispatchEvent('compositionend');
  await sheet(page).getByRole('button', { name: '중요 일정', exact: true }).click(); await title(page).press('Enter');
  await expect(title(page)).toHaveValue(''); await expect(title(page)).toBeFocused();
  await expect(sheet(page).getByRole('button', { name: '중요 일정', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await title(page).fill('두 번째'); await title(page).press('Enter'); await title(page).press('Enter'); await expect.poll(async () => (await data(page)).schedules.length).toBe(2);
  expect((await data(page)).schedules.find(s => s.title === '한글 조합중')).toMatchObject({ date: day, isImportant: true, category: '', startTime: '' });
  expect((await data(page)).schedules.find(s => s.title === '두 번째')?.isImportant).toBe(false);
  await page.evaluate(() => { const original = IDBObjectStore.prototype.put; (window as any).restorePut = () => IDBObjectStore.prototype.put = original; IDBObjectStore.prototype.put = function (...args) { if (this.name === 'changeHistory') throw new DOMException('Full', 'QuotaExceededError'); return original.apply(this, args); }; });
  await title(page).fill('실패 후 유지'); await title(page).press('Enter'); await expect(sheet(page).getByRole('alert')).toContainText('저장하지 못'); await expect(title(page)).toHaveValue('실패 후 유지'); expect((await data(page)).schedules).toHaveLength(2);
  await page.evaluate(() => (window as any).restorePut()); await title(page).press('Enter'); await expect.poll(async () => (await data(page)).schedules.length).toBe(3); await expect(title(page)).toBeFocused();
});

test('20회 개폐·Escape·뒤로가기·다른 날짜·세션 초안·스크롤과 포커스 복구', async ({ page }) => {
  for (let i = 0; i < 20; i++) {
    await open(page); await expect(page.locator('[data-day-overlay]')).toHaveCount(1); await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(sheet(page)).toHaveCSS('background-color', 'rgba(45, 35, 40, 0.25)');
    await sheet(page).getByRole('button', { name: '날짜 팝업 닫기' }).click(); await expect(sheet(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  }
  await open(page); await sheet(page).getByRole('button', { name: '일정 추가', exact: true }).click(); await title(page).fill('아직 저장하지 않은 문구');
  await sheet(page).getByRole('button', { name: '다음 날짜' }).click(); await expect(title(page)).toHaveCount(0);
  await sheet(page).getByRole('button', { name: '이전 날짜' }).click(); await expect(title(page)).toHaveValue('아직 저장하지 않은 문구');
  await page.keyboard.press('Escape'); await expect(sheet(page)).toHaveCount(0); expect((await data(page)).schedules).toHaveLength(0);
  await open(page); await expect(title(page)).toHaveValue('아직 저장하지 않은 문구'); await page.goBack(); await expect(sheet(page)).toHaveCount(0);
  const cell = page.locator(`[data-calendar-date="${day}"]`); await cell.focus(); await open(page); await sheet(page).click({ position: { x: 8, y: 3 } }); await expect(sheet(page)).toHaveCount(0); await expect(cell).toBeFocused();
});

test('빠른 프리셋 선택·검색·마우스 드롭·복구·관리·다른 입력 유지', async ({ page }) => {
  await seed(page); await open(page); await sheet(page).getByRole('button', { name: '일정 추가', exact: true }).click(); await title(page).fill('원래 제목');
  await sheet(page).getByRole('button', { name: '상세 옵션', exact: true }).click(); await sheet(page).getByRole('checkbox', { name: '시간 지정' }).check(); await sheet(page).getByLabel('시작 시간 분', { exact: true }).selectOption('05'); await sheet(page).getByRole('textbox', { name: '빠른 등록 메모' }).fill('유지할 메모'); await sheet(page).getByRole('button', { name: '일정 목록으로' }).click();
  await sheet(page).getByRole('button', { name: '프리셋', exact: true }).click(); await expect(sheet(page).locator('[data-quick-preset]')).toHaveCount(3); await expect(sheet(page).getByRole('button', { name: '집중 업무', exact: true })).toHaveCount(1);
  await presetMode(sheet(page),'replace'); await sheet(page).getByRole('button', { name: '집중 업무', exact: true }).click(); await sheet(page).getByRole('button',{name:'프리셋 패널 닫기'}).click(); await expect(title(page)).toHaveValue('집중 업무'); await sheet(page).getByRole('button', { name: '이전 제목 복구' }).click(); await expect(title(page)).toHaveValue('원래 제목');
  await sheet(page).getByRole('button', { name: '프리셋', exact: true }).click(); await sheet(page).getByRole('searchbox', { name: '프리셋 검색' }).fill('준비'); await presetMode(sheet(page),'replace'); await sheet(page).getByRole('button', { name: '준비 회의 입력창으로 드래그' }).dragTo(sheet(page).locator('[data-preset-drop]')); await expect(title(page)).toHaveValue('준비 회의'); await sheet(page).getByRole('button',{name:'프리셋 패널 닫기'}).click(); expect((await data(page)).schedules).toHaveLength(7);
  await sheet(page).getByRole('button', { name: '상세 옵션', exact: true }).click(); await expect(sheet(page).getByLabel('시작 시간 분', { exact: true })).toHaveValue('05'); await expect(sheet(page).getByRole('textbox', { name: '빠른 등록 메모' })).toHaveValue('유지할 메모');
  await sheet(page).getByRole('button', { name: '일정 목록으로' }).click(); await title(page).press('Enter'); await expect.poll(async () => (await data(page)).schedules.length).toBe(8); expect((await data(page)).schedules.find(s => s.title === '준비 회의')).toMatchObject({ startTime: '09:05', endTime: '10:00', memo: '유지할 메모' });
});

test('시트 안 카테고리 추가·HEX·이름·색상·삭제, 상세 등록 복귀와 초안 유지', async ({ page }) => {
  await open(page); await sheet(page).getByRole('button', { name: '일정 추가', exact: true }).click(); await title(page).fill('직접 분류할 일정');
  const categories = async () => { await sheet(page).getByRole('button', { name: '상세 옵션', exact: true }).click(); await sheet(page).getByRole('button', { name: '카테고리 선택', exact: true }).click(); await sheet(page).getByRole('button', { name: '카테고리 추가·관리' }).click(); };
  await categories(); await sheet(page).getByPlaceholder('카테고리 이름').fill('내 분류'); await sheet(page).getByLabel('HEX 색상').fill('#123456'); await sheet(page).getByRole('button', { name: '추가', exact: true }).click(); await expect(sheet(page).getByRole('button', { name: '카테고리 선택', exact: true })).toHaveText('내 분류'); await expect(title(page)).toHaveValue('직접 분류할 일정');
  await sheet(page).getByRole('button', { name: '상세 등록 열기' }).click(); const editor = page.getByRole('dialog', { name: '새 일정', exact: true }); await expect(page.getByRole('dialog')).toHaveCount(1); await expect(editor.getByLabel('일정 제목', { exact: true })).toHaveValue('직접 분류할 일정'); await expect(editor.getByRole('button', { name: '카테고리 선택', exact: true })).toHaveText('내 분류');
  await editor.getByRole('button', { name: '중요 일정', exact: true }).click(); await editor.getByRole('button', { name: '등록', exact: true }).click(); await expect(sheet(page)).toBeVisible(); await expect(title(page)).toHaveCount(0); await sheet(page).getByRole('button', { name: '일정 추가', exact: true }).click(); await expect(title(page)).toHaveValue('');
  await categories(); const row = sheet(page).locator('[data-category-id]'); await row.getByRole('button', { name: '수정', exact: true }).click(); await sheet(page).getByPlaceholder('카테고리 이름').fill('수정한 분류'); await sheet(page).getByRole('button', { name: '라벤더', exact: true }).click(); await sheet(page).getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await row.getByRole('button', { name: '삭제', exact: true }).click(); const confirmation = row.getByRole('group', { name: '카테고리 삭제 확인' }); await expect(confirmation).toContainText('일정 1개'); await confirmation.getByRole('button', { name: '삭제', exact: true }).click(); await expect(row).toHaveCount(0); expect((await data(page)).schedules[0]).toMatchObject({ title: '직접 분류할 일정', category: '', isImportant: true });
});

test('일정 드래그·동일 시간 순서·다른 시간 거부·새로고침 유지', async ({ page }) => {
  await seed(page); await open(page); await sheet(page).getByRole('button', { name: '목록형', exact: true }).click();
  await sheet(page).getByRole('button', { name: '같은 시간 업무 일정 순서 이동', exact: true }).dragTo(rows(page).filter({ hasText: '오전 업무' }));
  await expect(rows(page).first()).toContainText('같은 시간 업무');
  await sheet(page).getByRole('button', { name: '오후 개인 일정 순서 이동', exact: true }).dragTo(rows(page).filter({ hasText: '같은 시간 업무' })); await expect(sheet(page).getByRole('alert')).toContainText('같은 시작 시간'); await expect(rows(page).first()).toContainText('같은 시간 업무');
  await sheet(page).getByRole('button', { name: '시간 없는 둘째 일정 순서 이동', exact: true }).dragTo(rows(page).filter({ hasText: '시간 없는 첫째' })); await expect(rows(page).last()).toContainText('시간 없는 첫째');
  await page.reload({ waitUntil: 'domcontentloaded' }); await open(page); await expect(rows(page).last()).toContainText('시간 없는 첫째'); await expect(rows(page).first()).toContainText('같은 시간 업무');
});

test('반복 일정 한 회차 수정·실행 취소와 백업 왕복', async ({ page }) => {
  await seed(page); await page.evaluate(async day => { const path = '/src/db/indexedDB.ts'; const db = await import(path); await db.saveSchedule({ id: 'series', title: '매일 반복', date: day, category: '', completed: false, recurrenceRuleId: 'daily' }); await db.saveRecurrenceRule({ id: 'daily', scheduleId: 'series', frequency: 'daily', startDate: day, endDate: '2026-11-02' }); }, day); await page.reload({ waitUntil: 'domcontentloaded' });
  await open(page); await sheet(page).getByRole('button', { name: '매일 반복 수정', exact: true }).click(); const editor = page.getByRole('dialog', { name: '일정 수정', exact: true }); await editor.getByRole('button', { name: '중요 일정', exact: true }).click(); await editor.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await expect(sheet(page)).toBeVisible(); await expect(rows(page).filter({ hasText: '매일 반복' }).getByLabel('중요 일정', { exact: true })).toBeVisible();
  let stored = await data(page); expect(stored.schedules.find(s => s.id === 'series')?.isImportant).toBeUndefined(); expect(stored.recurrenceRules).toHaveLength(1); expect(stored.recurrenceExceptions).toHaveLength(1);
  await sheet(page).getByRole('button', { name: '날짜 팝업 닫기' }).click(); await page.getByRole('button', { name: '실행 취소', exact: true }).click(); await expect.poll(async () => (await data(page)).recurrenceExceptions.length).toBe(0);
  const before = await data(page); await page.evaluate(async before => { const path = '/src/db/indexedDB.ts'; await (await import(path)).importAllData(JSON.parse(JSON.stringify(before))); }, before); stored = await data(page); expect(stored).toEqual(before);
});

test('긴 목록 내부 스크롤·축소 키보드 영역·입력 및 등록 버튼 노출', async ({ page }) => {
  await seed(page, true); await open(page); const scroll = sheet(page).locator('[data-day-scroll]');
  expect(await scroll.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true); await scroll.evaluate(el => el.scrollTop = el.scrollHeight); expect(await page.evaluate(() => scrollY)).toBe(0);
  await sheet(page).getByRole('button', { name: '일정 추가', exact: true }).click(); await title(page).fill('작은 키보드 공간');
  await page.setViewportSize({ width: 390, height: 400 }); await expect(title(page)).toBeInViewport(); await expect(sheet(page).getByRole('button', { name: '등록', exact: true })).toBeInViewport(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/v13-keyboard-area.png' }); await title(page).press('Enter'); await expect.poll(async () => (await data(page)).schedules.some(s => s.title === '작은 키보드 공간')).toBe(true);
});

test('실제 터치 길게 드래그로 일정 순서 및 프리셋 입력 적용', async ({ page, context }) => {
  await seed(page); await open(page); await sheet(page).getByRole('button', { name: '목록형', exact: true }).click();
  const cdp = await context.newCDPSession(page);
  async function drag(from: Locator, to: Locator) {
    await from.scrollIntoViewIfNeeded(); const a = (await from.boundingBox())!, b = (await to.boundingBox())!;
    const start = { x: a.x+a.width/2, y: a.y+a.height/2 }, end = { x: b.x+b.width/2, y: b.y+b.height/2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] }); await page.waitForTimeout(360);
    for (let i=1;i<=15;i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x+(end.x-start.x)*i/15, y: start.y+(end.y-start.y)*i/15 }] }); await page.waitForTimeout(17); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await drag(sheet(page).getByRole('button', { name: '같은 시간 업무 일정 순서 이동' }), rows(page).filter({ hasText: '오전 업무' })); await expect(rows(page).first()).toContainText('같은 시간 업무');
  await sheet(page).getByRole('button', { name: '일정 추가', exact: true }).click(); await sheet(page).getByRole('button', { name: '프리셋', exact: true }).click();
  await drag(sheet(page).getByRole('button', { name: '집중 업무 입력창으로 드래그' }), sheet(page).locator('[data-preset-drop]')); await expect(title(page)).toHaveValue('집중 업무'); expect((await data(page)).schedules).toHaveLength(7);
});

test('시트 관리 패널 반복 전환·프리셋 편집·HEX 미완성 입력 취소와 초안 보존', async ({ page }) => {
  await seed(page); await open(page); await sheet(page).getByRole('button', { name: '일정 추가', exact: true }).click(); await title(page).fill('계속 작성할 초안');
  for (let i=0;i<20;i++) {
    await sheet(page).getByRole('button', { name: '프리셋', exact: true }).click(); await page.keyboard.press('Escape');
    await sheet(page).getByRole('button', { name: '상세 옵션', exact: true }).click(); await sheet(page).getByRole('button', { name: '카테고리 선택', exact: true }).click(); await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(1); await expect(page.locator('[data-day-overlay]')).toHaveCount(1); await expect(title(page)).toHaveValue('계속 작성할 초안');
  }
  await sheet(page).getByRole('button', { name: '프리셋', exact: true }).click(); await sheet(page).getByRole('button', { name: '프리셋 관리', exact: true }).click();
  await sheet(page).getByRole('button', { name: '새 프리셋 추가', exact: true }).click(); await sheet(page).getByPlaceholder('프리셋 내용을 입력하세요').fill('시트에서 새 문구'); await sheet(page).getByRole('button', { name: '프리셋 저장', exact: true }).click();
  const phrase = sheet(page).locator('[data-phrase-id]').filter({ hasText: '시트에서 새 문구' }); await phrase.getByRole('button', { name: '프리셋 수정', exact: true }).click(); await sheet(page).getByRole('textbox', { name: '프리셋 수정 내용' }).fill('수정 중인 문구'); await page.goBack();
  await expect(sheet(page).getByRole('button', { name: '계속 작성', exact: true })).toBeVisible(); await sheet(page).getByRole('button', { name: '계속 작성', exact: true }).click(); await expect(sheet(page).getByRole('textbox', { name: '프리셋 수정 내용' })).toHaveValue('수정 중인 문구'); await sheet(page).getByRole('button', { name: '변경사항 저장' }).click();
  await sheet(page).getByRole('button', { name: '일정 목록으로' }).click(); await expect(title(page)).toHaveValue('계속 작성할 초안');
  await sheet(page).getByRole('button', { name: '상세 옵션', exact: true }).click(); await sheet(page).getByRole('button', { name: '카테고리 선택', exact: true }).click(); await sheet(page).getByRole('button', { name: '카테고리 추가·관리' }).click();
  await sheet(page).getByLabel('HEX 색상').fill('#1'); await sheet(page).getByRole('button', { name: '취소', exact: true }).click(); await sheet(page).getByRole('button', { name: '등록 취소', exact: true }).click(); await expect(sheet(page).getByLabel('HEX 색상')).toHaveValue('#CF8FA8');
  await sheet(page).getByPlaceholder('카테고리 이름').fill('이름만 추가'); await sheet(page).getByRole('button', { name: '추가', exact: true }).click(); expect((await data(page)).categories.find(c => c.name === '이름만 추가')?.color).toBe('#CF8FA8'); await expect(title(page)).toHaveValue('계속 작성할 초안');
});

test('저장 실패 시 일정 순서 롤백·동시 전송 방지·시트 안 실행 취소', async ({ page }) => {
  await seed(page); await open(page); await sheet(page).getByRole('button', { name: '목록형', exact: true }).click(); const before = (await data(page)).schedules;
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; (window as any).restore = () => IDBObjectStore.prototype.put = put; IDBObjectStore.prototype.put = function (...args) { if (this.name === 'changeHistory') throw new DOMException('Full', 'QuotaExceededError'); return put.apply(this, args); }; });
  await sheet(page).getByRole('button', { name: '같은 시간 업무 일정 순서 이동', exact: true }).dragTo(rows(page).filter({ hasText: '오전 업무' })); await expect(sheet(page).getByRole('alert')).toContainText('저장하지 못'); await expect(rows(page).first()).toContainText('오전 업무'); expect((await data(page)).schedules).toEqual(before); await page.evaluate(() => (window as any).restore());
  await sheet(page).getByRole('button', { name: '일정 추가', exact: true }).click(); await title(page).fill('중복 요청 없이 한 번');
  await title(page).evaluate((el: HTMLInputElement) => { el.form!.requestSubmit(); el.form!.requestSubmit(); }); await expect.poll(async () => (await data(page)).schedules.length).toBe(8); await expect(title(page)).toHaveValue('');
  await page.setViewportSize({ width: 320, height: 430 }); await expect(title(page)).toBeInViewport(); await expect(sheet(page).getByRole('button', { name: '등록', exact: true })).toBeInViewport(); await expect(sheet(page).getByRole('button', { name: '실행 취소', exact: true })).toBeVisible(); await page.screenshot({ path: 'test-results/v13-saved-small.png' });
  await sheet(page).getByRole('button', { name: '실행 취소', exact: true }).click(); await expect.poll(async () => (await data(page)).schedules.length).toBe(7); await expect(title(page)).toHaveValue('');
});

test('반복 일정 이동·복사와 원본 시리즈 보존', async ({ page }) => {
  await seed(page); await page.evaluate(async day => { const path = '/src/db/indexedDB.ts'; const db = await import(path); await db.saveSchedule({ id: 'series', title: '매일 반복', date: day, category: '', completed: false, recurrenceRuleId: 'daily' }); await db.saveRecurrenceRule({ id: 'daily', scheduleId: 'series', frequency: 'daily', startDate: day, endDate: '2026-11-02' }); }, day); await page.reload({ waitUntil: 'domcontentloaded' }); await open(page);
  await sheet(page).getByRole('button', { name: '매일 반복 이동/복사', exact: true }).click(); let move = page.getByRole('dialog', { name: '일정 이동 / 복사', exact: true }); await chooseDate(move, '대상 날짜', '2026-10-30'); await move.getByRole('button', { name: '이동', exact: true }).click(); await expect(sheet(page)).toBeVisible(); await expect(rows(page).filter({ hasText: '매일 반복' })).toHaveCount(0);
  await sheet(page).getByRole('button', { name: '다음 날짜' }).click(); await expect(rows(page).filter({ hasText: '매일 반복' })).toHaveCount(2); await sheet(page).getByRole('button', { name: '실행 취소', exact: true }).click(); await expect(rows(page).filter({ hasText: '매일 반복' })).toHaveCount(1);
  await sheet(page).getByRole('button', { name: '매일 반복 이동/복사', exact: true }).click(); move = page.getByRole('dialog', { name: '일정 이동 / 복사', exact: true }); await chooseDate(move, '대상 날짜', '2026-10-31'); await move.getByRole('button', { name: '복사', exact: true }).click(); await expect(sheet(page)).toBeVisible();
  const stored = await data(page); expect(stored.schedules.filter(s => s.title === '매일 반복')).toHaveLength(2); expect(stored.schedules.find(s => s.id === 'series')).toMatchObject({ date: day, recurrenceRuleId: 'daily' }); expect(stored.schedules.find(s => s.id !== 'series' && s.title === '매일 반복')?.recurrenceRuleId).toBeUndefined(); expect(stored.recurrenceRules).toHaveLength(1); expect(stored.recurrenceExceptions).toHaveLength(0);
});

test('중요 초안 상세 연속·여러 날짜 등록 후 초기화 및 데스크톱 복귀', async ({ page }) => {
  await open(page); await sheet(page).getByRole('button', { name: '일정 추가', exact: true }).click(); await title(page).fill('중요한 연속 일정'); await sheet(page).getByRole('button', { name: '중요 일정', exact: true }).click();
  const details = async () => { await sheet(page).getByRole('button', { name: '상세 옵션', exact: true }).click(); await sheet(page).getByRole('button', { name: '상세 등록 열기' }).click(); return page.getByRole('dialog', { name: '새 일정', exact: true }); };
  let editor = await details(); await editor.getByRole('checkbox', { name: '계속 등록', exact: true }).check(); await editor.getByRole('button', { name: '등록 후 계속' }).click(); await expect(editor.getByRole('button', { name: '중요 일정', exact: true })).toHaveAttribute('aria-pressed', 'false'); await editor.getByRole('button', { name: '닫기', exact: true }).click(); await expect(sheet(page)).toBeVisible(); await expect(page.getByText('등록을 취소할까요?', { exact: true })).toHaveCount(0);
  await sheet(page).getByRole('button', { name: '일정 추가', exact: true }).click(); await title(page).fill('여러 날짜 초안'); editor = await details(); await editor.getByRole('button', { name: '여러 날짜 선택', exact: true }).click(); await editor.getByRole('button', { name: '기준일부터 3일 선택', exact: true }).click(); await editor.getByRole('button', { name: '뒤로', exact: true }).click(); await editor.getByRole('button', { name: '3개 등록', exact: true }).click(); await expect(sheet(page)).toBeVisible(); await sheet(page).getByRole('button', { name: '일정 추가', exact: true }).click(); await expect(title(page)).toHaveValue(''); expect((await data(page)).schedules).toHaveLength(4);
  await sheet(page).getByRole('button', { name: '중요한 연속 일정 수정', exact: true }).click(); const edit = page.getByRole('dialog', { name: '일정 수정', exact: true }); await page.setViewportSize({ width: 1280, height: 900 }); await edit.getByRole('button', { name: '취소', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '일정 검색', exact: true }).click(); const search = page.getByRole('dialog', { name: '일정 검색', exact: true }); await search.getByRole('searchbox', { name: '일정 검색어' }).fill('중요한 연속'); await expect(search.getByLabel('중요 일정', { exact: true })).toBeVisible(); await expect(search.getByText('중요한 연속 일정', { exact: true })).toHaveCSS('font-weight', '700');
});

test('상세 반복 등록·원자적 실패·일별 표시·실행 취소와 백업 보존', async ({ page }) => {
  await open(page); await sheet(page).getByRole('button', { name: '일정 추가', exact: true }).click(); await title(page).fill('상세에서 매일 반복'); await sheet(page).getByRole('button', { name: '상세 옵션', exact: true }).click(); await sheet(page).getByRole('button', { name: '상세 등록 열기' }).click();
  const editor = page.getByRole('dialog', { name: '새 일정', exact: true }); await editor.getByRole('button', { name: '+ 상세 옵션 (메모)', exact: true }).click(); await editor.getByLabel('반복', { exact: true }).selectOption('daily'); await chooseDate(editor, '반복 종료일', '2026-10-31');
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; (window as any).restore = () => IDBObjectStore.prototype.put = put; IDBObjectStore.prototype.put = function (...args) { if (this.name === 'changeHistory') throw new DOMException('Full', 'QuotaExceededError'); return put.apply(this, args); }; });
  await editor.getByRole('button', { name: '등록', exact: true }).click(); await expect(editor.getByRole('alert')).toContainText('저장하지 못'); expect((await data(page)).schedules).toHaveLength(0); expect((await data(page)).recurrenceRules).toHaveLength(0); await expect(editor.getByLabel('반복', { exact: true })).toHaveValue('daily'); await page.evaluate(() => (window as any).restore());
  await editor.getByRole('button', { name: '등록', exact: true }).click(); await expect(sheet(page)).toBeVisible(); await expect(rows(page).filter({ hasText: '상세에서 매일 반복' })).toHaveCount(1); await sheet(page).getByRole('button', { name: '다음 날짜' }).click(); await expect(rows(page).filter({ hasText: '상세에서 매일 반복' })).toHaveCount(1);
  const stored = await data(page); expect(stored.recurrenceRules).toHaveLength(1); expect(stored.recurrenceRules[0]).toMatchObject({ frequency: 'daily', startDate: day, endDate: '2026-10-31' }); expect(stored.schedules[0].recurrenceRuleId).toBe(stored.recurrenceRules[0].id);
  await page.evaluate(async data => { const path = '/src/db/indexedDB.ts'; await (await import(path)).importAllData(JSON.parse(JSON.stringify(data))); }, stored); expect(await data(page)).toEqual(stored);
  await sheet(page).getByRole('button', { name: '실행 취소', exact: true }).click(); await expect.poll(async () => (await data(page)).schedules.length).toBe(0); expect((await data(page)).recurrenceRules).toHaveLength(0);
});

test('상세 반복 연속 등록은 독립 시리즈이며 저장 후 빈 초안으로 닫기', async ({ page }) => {
  await page.getByRole('button', { name: '일정 등록', exact: true }).click(); const editor = page.getByRole('dialog', { name: '새 일정', exact: true }); await editor.getByRole('button', { name: '+ 상세 옵션 (메모)', exact: true }).click(); await editor.getByLabel('반복', { exact: true }).selectOption('weekly'); await editor.getByRole('checkbox', { name: '계속 등록', exact: true }).check();
  await editor.getByLabel('일정 제목', { exact: true }).fill('첫 번째 주간 일정'); await editor.getByRole('button', { name: '등록 후 계속', exact: true }).click(); await expect(editor.getByLabel('일정 제목', { exact: true })).toHaveValue(''); await editor.getByLabel('일정 제목', { exact: true }).fill('두 번째 주간 일정'); await editor.getByRole('button', { name: '등록 후 계속', exact: true }).click(); await editor.getByRole('button', { name: '닫기', exact: true }).click(); await expect(editor).toHaveCount(0); await expect(page.getByText('등록을 취소할까요?', { exact: true })).toHaveCount(0);
  const stored = await data(page); expect(stored.schedules).toHaveLength(2); expect(stored.recurrenceRules).toHaveLength(2); expect(new Set(stored.schedules.map(s => s.recurrenceRuleId)).size).toBe(2); expect(stored.recurrenceRules.every(r => stored.schedules.some(s => s.id === r.scheduleId))).toBe(true);
});
