import type { Locator, Page } from '@playwright/test';

/** 일정 등록 창에서 카테고리 고르기(11월부터 일정 카테고리는 필수). 이름을 안 주면 첫 카테고리 */
/** 앱은 기본 카테고리를 넣지 않으므로, 카테고리가 하나도 없으면 시험용 4개(일·중요·기타·데이트)를 넣는다 */
export async function ensureCategories(scope: Locator | Page) {
  const page = 'page' in scope ? scope.page() : scope;
  await page.evaluate(async () => {
    const path = '/src/db/indexedDB.ts'; const db = await import(path);
    if ((await db.getAllCategories()).length) return;
    const seed = [['category-work', '일', '#A4ADD0'], ['category-important', '중요', '#B4A2D3'], ['category-other', '기타', '#D6C796'], ['category-date', '데이트', '#CF8FA8']];
    for (const [i, [id, name, color]] of seed.entries()) await db.saveCategory({ id, name, color, sortOrder: i, isUserManaged: true });
    window.dispatchEvent(new Event('preset-groups-changed'));
  });
}

export async function pickCategory(modal: Locator, name?: string) {
  await ensureCategories(modal);
  const button = modal.getByRole('button', { name: '카테고리 선택', exact: true });
  // 이름을 안 줬고 이미 골라 둔 카테고리가 있으면 그대로 둔다
  if (!name && !(await button.innerText()).includes('미분류')) return;
  await button.click();
  const grid = modal.getByRole('group', { name: '카테고리 목록' });
  await (name ? grid.getByRole('button', { name, exact: true }) : grid.getByRole('button').first()).click();
}

/** 날짜 팝업 간편 등록 시작(11-06부터 '일정 등록하기' → 카테고리 먼저 고르기 → 제목 입력). 이미 입력 칸이 있으면 그대로 */
export async function startQuick(sheet: Locator, name?: string) {
  const title = sheet.getByLabel('빠른 일정 제목', { exact: true });
  if (await title.isVisible()) return title;
  await ensureCategories(sheet);
  await sheet.getByRole('button', { name: '일정 등록하기', exact: true }).click();
  const grid = sheet.getByRole('group', { name: '카테고리 목록' });
  await (name ? grid.getByRole('button', { name, exact: true }) : grid.getByRole('button').first()).click();
  await title.waitFor();
  return title;
}

/** 날짜 팝업 닫기: 간편 입력 시트가 위에 떠 있으면 먼저 닫는다(11-06부터 입력 시트가 날짜 팝업 위에 따로 뜸) */
export async function closeSheet(sheet: Locator | Page) {
  const composer = sheet.getByRole('button', { name: '간편 등록 닫기', exact: true });
  if (await composer.isVisible()) await composer.click();
  await sheet.getByRole('button', { name: '날짜 팝업 닫기' }).click();
}
