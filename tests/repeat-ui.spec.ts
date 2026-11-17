import { test, expect, type Page } from '@playwright/test';
import { startQuick } from './helpers/category';
import type { AppData } from '../src/types';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
// 이번 달 2일(월말 넘김 없이 다음 주 날짜까지 같은 달에 보이도록)
const ym = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
const at = (n: number) => ym + '-' + String(n).padStart(2, '0');
const sheet = (page: Page) => page.getByRole('dialog', { name: '날짜별 일정', exact: true });
async function data(page: Page): Promise<AppData> { return page.evaluate(async () => { const path = '/src/db/indexedDB.ts'; return (await import(path)).exportAllData(); }); }

test.beforeEach(async ({ page }) => {
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
});

test('간편 입력에서 매주 여러 요일·횟수로 반복 등록', async ({ page }) => {
  await page.locator(`[data-calendar-date="${at(2)}"]`).click();
  const title = await startQuick(sheet(page));
  await title.fill('요일 반복');
  await sheet(page).getByRole('button', { name: /^반복 설정/ }).click();
  const picker = sheet(page).locator('[data-repeat-picker]');
  await picker.getByLabel('반복', { exact: true }).selectOption('weekly');
  const weekday = new Date(at(2) + 'T12:00:00').getDay(), other = (weekday + 2) % 7;
  await expect(picker.getByRole('button', { name: ['일', '월', '화', '수', '목', '금', '토'][weekday] + '요일' })).toHaveAttribute('aria-pressed', 'true');
  await picker.getByRole('button', { name: ['일', '월', '화', '수', '목', '금', '토'][other] + '요일' }).click();
  await picker.getByRole('radio', { name: '횟수', exact: true }).click();
  await picker.getByLabel('반복 횟수', { exact: true }).fill('3');
  await sheet(page).getByRole('button', { name: '반복 적용', exact: true }).click();
  await expect(sheet(page).getByRole('button', { name: /^반복 설정: 매주 .+ · 3번$/ })).toBeVisible();
  await sheet(page).getByRole('button', { name: '등록', exact: true }).click();
  await expect(sheet(page).locator('[data-day-schedule]').filter({ hasText: '요일 반복' })).toHaveCount(1);

  const stored = await data(page);
  const rule = stored.recurrenceRules.find(r => r.scheduleId === stored.schedules.find(s => s.title === '요일 반복')!.id)!;
  expect(rule).toMatchObject({ frequency: 'weekly', count: 3, startDate: at(2) });
  expect([...rule.weekdays!].sort()).toEqual([weekday, other].sort());
  // 등록 후 입력창 반복 설정은 비워진다
  await expect(sheet(page).getByRole('button', { name: '반복 설정: 반복 없음' })).toBeVisible();
});

test('없는 날짜 처리 칸은 29일 이후에만 나오고, 2주마다는 요일이 있어야 저장된다', async ({ page }) => {
  await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정', exact: true });
  await editor.getByRole('button', { name: '+ 상세 옵션 (메모)', exact: true }).click();
  await editor.getByLabel('반복', { exact: true }).selectOption('monthly');
  // 선택지에 실제 날짜가 보인다(오늘 날짜 기준)
  const now = new Date();
  await expect(editor.getByLabel('반복', { exact: true }).locator('option[value="monthly"]')).toHaveText(`매월 ${now.getDate()}일`);
  await expect(editor.getByLabel('반복', { exact: true }).locator('option[value="yearly"]')).toHaveText(`매년 ${now.getMonth() + 1}월 ${now.getDate()}일`);
  // 오늘이 29일 이후가 아니면 없는 날짜 처리 칸은 나오지 않는다
  const today = new Date().getDate();
  await expect(editor.getByLabel('없는 날짜 처리')).toHaveCount(today > 28 ? 1 : 0);
  await editor.getByLabel('반복', { exact: true }).selectOption('yearly');
  await editor.getByLabel('반복', { exact: true }).selectOption('biweekly');
  await expect(editor.getByRole('group', { name: '반복 요일' })).toBeVisible();
  // 요일을 모두 끄면 저장할 수 없다
  for (const b of await editor.getByRole('group', { name: '반복 요일' }).getByRole('button', { pressed: true }).all()) await b.click();
  await editor.getByLabel('일정 제목', { exact: true }).fill('요일 없음');
  await editor.getByRole('button', { name: '등록', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('요일을 하나 이상');
});

async function seedSeries(page: Page) {
  await page.evaluate(async ({ start }) => {
    const path = '/src/db/indexedDB.ts'; const db = await import(path);
    await db.saveSchedule({ id: 'series', title: '매일 운동', date: start, category: '', completed: false, recurrenceRuleId: 'daily' });
    await db.saveRecurrenceRule({ id: 'daily', scheduleId: 'series', frequency: 'daily', startDate: start, count: 6 });
  }, { start: at(2) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
}
const editAt = async (page: Page, day: number) => {
  await page.locator(`[data-calendar-date="${at(day)}"]`).click();
  await sheet(page).getByRole('button', { name: /운동 수정$/ }).click();
  return page.getByRole('dialog', { name: '일정 수정', exact: true });
};

test('이후 모든 일정 수정: 앞 회차는 그대로, 실행 취소로 되돌림', async ({ page }) => {
  await seedSeries(page);
  const editor = await editAt(page, 4);
  await editor.getByLabel('일정 제목', { exact: true }).fill('저녁 운동');
  await editor.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await editor.getByRole('group', { name: '반복 일정 수정 범위' }).getByRole('button', { name: '이 일정과 이후 일정 저장', exact: true }).click();
  await expect(sheet(page).locator('[data-day-schedule]').filter({ hasText: '저녁 운동' })).toHaveCount(1);
  const stored = await data(page);
  expect(stored.recurrenceRules.find(r => r.id === 'daily')).toMatchObject({ endDate: at(3), count: 6 });
  const next = stored.recurrenceRules.find(r => r.id !== 'daily')!;
  expect(next).toMatchObject({ frequency: 'daily', startDate: at(4), count: 4 });
  expect(stored.schedules.find(s => s.id === next.scheduleId)).toMatchObject({ title: '저녁 운동', date: at(4) });
  await sheet(page).getByRole('button', { name: '실행 취소', exact: true }).first().click();
  await expect.poll(async () => (await data(page)).recurrenceRules.length).toBe(1);
  expect((await data(page)).recurrenceRules[0]).toMatchObject({ id: 'daily', count: 6 });
  expect((await data(page)).recurrenceRules[0].endDate).toBeUndefined();
});

test('모든 반복 일정 삭제와 이 일정만 삭제', async ({ page }) => {
  await seedSeries(page);
  let editor = await editAt(page, 3);
  await editor.getByRole('button', { name: '일정 삭제' }).click();
  await editor.getByRole('group', { name: '일정 삭제 확인' }).getByRole('button', { name: '이 일정만 삭제', exact: true }).click();
  await expect.poll(async () => (await data(page)).recurrenceExceptions.map(e => [e.originalDate, e.action])).toEqual([[at(3), 'cancelled']]);
  await sheet(page).getByRole('button', { name: '날짜 팝업 닫기' }).click();
  editor = await editAt(page, 5);
  await editor.getByRole('button', { name: '일정 삭제' }).click();
  await editor.getByRole('group', { name: '일정 삭제 확인' }).getByRole('button', { name: '모든 반복 일정 삭제', exact: true }).click();
  await expect.poll(async () => { const d = await data(page); return [d.schedules.length, d.recurrenceRules.length, d.recurrenceExceptions.length]; }).toEqual([0, 0, 0]);
});
