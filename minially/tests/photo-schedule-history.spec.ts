import { test, expect, type Page } from '@playwright/test';

// 글로 넣기 고도화: 반복 일정 등록, 비슷하지만 다른 일정, 예전 같은 일정 기준 채우기·중복 알림·되돌린 제목 기억
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

async function seed(page: Page, schedules: object[]) {
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.evaluate(async list => {
    const path = '/src/db/indexedDB.ts';
    await (await import(path)).importAllData({ categories: [{ id: 'health', name: '병원', color: '#CF8FA8' }, { id: 'hobby', name: '취미', color: '#94BED9' }, { id: 'kid', name: '아이', color: '#A8CF8F' }], schedules: list });
  }, schedules);
  await page.reload(); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
}
async function paste(page: Page, text: string) {
  await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  await page.getByRole('dialog', { name: '새 일정' }).getByRole('button', { name: '사진으로 일정 넣기' }).click();
  const sheet = page.getByRole('dialog', { name: '사진으로 일정 넣기' });
  await sheet.getByLabel('문자·메일 붙여넣기').fill(text);
  await sheet.getByRole('button', { name: '글에서 찾기' }).click();
  return sheet;
}

test('반복 글(매주 화·목)은 반복 규칙으로 등록하고, 끄면 하루만 넣는다', async ({ page }) => {
  await seed(page, []);
  const sheet = await paste(page, '매주 화·목 오후 4시 피아노 레슨 (12월부터)');
  const row = sheet.locator('[data-photo-event]').first();
  await expect(row.getByLabel('일정 제목')).toHaveValue('피아노 레슨');
  await expect(row).toContainText('반복: 매주 화·목');
  await expect(row.getByLabel('피아노 레슨 반복으로 등록')).toBeChecked();
  await sheet.getByRole('button', { name: '1개 등록' }).click();
  await expect(sheet).toHaveCount(0);
  const saved = await page.evaluate(async () => {
    const m = await import('/src/db/indexedDB.ts' as string);
    const s = (await m.getAllSchedules()).find((x: { title: string }) => x.title === '피아노 레슨');
    const r = (await m.getAllRecurrenceRules()).find((x: { scheduleId: string }) => x.scheduleId === s.id);
    return { start: s.startTime, rule: r && { frequency: r.frequency, weekdays: r.weekdays, interval: r.interval, startDate: r.startDate.slice(5) } };
  });
  expect(saved).toEqual({ start: '16:00', rule: { frequency: 'weekly', weekdays: [2, 4], interval: 1, startDate: '12-01' } });
});

test('비슷하지만 다른 일정(교정 상담)은 예전 제목으로 바꾸지 않고, 같은 일정이면 예전 시간·장소를 채우고 반복을 제안한다', async ({ page }) => {
  const s = (id: string, title: string, date: string, category: string, extra = {}) => ({ id, title, date, category, completed: false, ...extra });
  await seed(page, [
    s('a', '치과 정기 검진', '2026-09-10', 'health', { startTime: '10:30', endTime: '11:00', memo: '장소: 밝은미소치과 2층' }), s('b', '치과 정기 검진', '2026-06-10', 'health', { startTime: '10:30', endTime: '11:00' }),
    s('c', '피아노 레슨', '2026-11-03', 'hobby', { startTime: '16:00', endTime: '17:00' }), s('d', '피아노 레슨', '2026-11-10', 'hobby', { startTime: '16:00', endTime: '17:00' }), s('e', '피아노 레슨', '2026-11-17', 'hobby', { startTime: '16:00', endTime: '17:00' }),
  ]);
  let sheet = await paste(page, '[밝은미소치과] 12월 9일 오후 3시 교정 상담 예약되었습니다.');
  let row = sheet.locator('[data-photo-event]').first();
  await expect(row.getByLabel('일정 제목')).toHaveValue('밝은미소치과 교정 상담'); // 정기 검진으로 바꾸지 않는다
  await expect(row.getByLabel('카테고리')).toHaveValue('health');
  await expect(row).toContainText('다른 일정일 수 있어요');
  await expect(row.getByRole('button', { name: /예전처럼 ‘치과/ })).toHaveCount(0);
  await sheet.getByRole('button', { name: '사진으로 일정 넣기 닫기' }).click();

  sheet = await paste(page, '12월 8일 피아노 레슨');
  row = sheet.locator('[data-photo-event]').first();
  await expect(row.getByLabel('시작 시간')).toHaveValue('16:00');
  await expect(row.getByLabel('끝 시간')).toHaveValue('17:00');
  await expect(row).toContainText('예전 같은 일정 기준으로 채웠어요: 시작 시각·끝 시각');
  await row.getByRole('button', { name: '예전처럼 매주 반복으로 넣기' }).click();
  await expect(row).toContainText('반복: 매주 화');
});

test('같은 날 같은 일정이 이미 있으면 체크를 꺼 두고, 되돌린 제목 바꾸기는 다음에도 기억한다', async ({ page }) => {
  const s = (id: string, title: string, date: string) => ({ id, title, date, category: 'health', completed: false });
  await seed(page, [s('a', '치과 정기 검진', '2026-10-01'), s('b', '치과 정기 검진', '2026-11-01'), s('c', '치과 정기 검진', '2026-12-15')]);
  let sheet = await paste(page, '[밝은미소치과] 12월 15일 진료 예약되었습니다.');
  let row = sheet.locator('[data-photo-event]').first();
  await expect(row).toContainText('이미 있어요');
  await expect(row.getByRole('checkbox').first()).not.toBeChecked();
  await sheet.getByRole('button', { name: '사진으로 일정 넣기 닫기' }).click();

  sheet = await paste(page, '[밝은미소치과] 12월 22일 오후 2시 진료 예약되었습니다.');
  row = sheet.locator('[data-photo-event]').first();
  await expect(row.getByLabel('일정 제목')).toHaveValue('치과 정기 검진');
  await row.getByRole('button', { name: '원래대로' }).click();
  await expect(row.getByLabel('일정 제목')).toHaveValue('밝은미소치과 진료');
  await sheet.getByRole('button', { name: '사진으로 일정 넣기 닫기' }).click();
  await expect.poll(async () => page.evaluate(async () => ((await (await import('/src/db/indexedDB.ts' as string)).getAppSettings()).titleRejects ?? []).length)).toBe(1);
  sheet = await paste(page, '[밝은미소치과] 12월 29일 오후 2시 진료 예약되었습니다.');
  row = sheet.locator('[data-photo-event]').first();
  await expect(row.getByLabel('일정 제목')).toHaveValue('밝은미소치과 진료'); // 다시 자동으로 바꾸지 않는다
  await expect(row.getByRole('button', { name: /예전처럼 ‘치과 정기 검진’/ })).toBeVisible();
});

test('오전·오후 없는 시간은 오후로 짐작했다고 알려 준다', async ({ page }) => {
  await seed(page, []);
  const sheet = await paste(page, '다음 주 수요일 3시에 팀 회의 있어요');
  const row = sheet.locator('[data-photo-event]').first();
  await expect(row.getByLabel('시작 시간')).toHaveValue('15:00');
  await expect(row).toContainText('오후로 짐작했어요');
  await expect(row.getByRole('checkbox').first()).not.toBeChecked();
});
