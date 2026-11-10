import type { Locator } from '@playwright/test';

/** 일정 등록 창에서 카테고리 고르기(11월부터 일정 카테고리는 필수). 이름을 안 주면 첫 카테고리 */
export async function pickCategory(modal: Locator, name?: string) {
  await modal.getByRole('button', { name: '카테고리 선택', exact: true }).click();
  const grid = modal.getByRole('group', { name: '카테고리 목록' });
  await (name ? grid.getByRole('button', { name, exact: true }) : grid.getByRole('button').first()).click();
}

/** 날짜 팝업 간편 등록 시작(11-06부터 '일정 등록하기' → 카테고리 먼저 고르기 → 제목 입력). 이미 입력 칸이 있으면 그대로 */
export async function startQuick(sheet: Locator, name?: string) {
  const title = sheet.getByLabel('빠른 일정 제목', { exact: true });
  if (await title.isVisible()) return title;
  await sheet.getByRole('button', { name: '일정 등록하기', exact: true }).click();
  const grid = sheet.getByRole('group', { name: '카테고리 목록' });
  await (name ? grid.getByRole('button', { name, exact: true }) : grid.getByRole('button').first()).click();
  await title.waitFor();
  return title;
}

/** 날짜 팝업 닫기: 간편 입력 시트가 위에 떠 있으면 먼저 닫는다(11-06부터 입력 시트가 날짜 팝업 위에 따로 뜸) */
export async function closeSheet(sheet: Locator) {
  const composer = sheet.getByRole('button', { name: '간편 등록 닫기', exact: true });
  if (await composer.isVisible()) await composer.click();
  await sheet.getByRole('button', { name: '날짜 팝업 닫기' }).click();
}
