import type { Locator } from '@playwright/test';

/** 일정 등록 창에서 카테고리 고르기(11월부터 일정 카테고리는 필수). 이름을 안 주면 첫 카테고리 */
export async function pickCategory(modal: Locator, name?: string) {
  await modal.getByRole('button', { name: '카테고리 선택', exact: true }).click();
  const grid = modal.getByRole('group', { name: '카테고리 목록' });
  await (name ? grid.getByRole('button', { name, exact: true }) : grid.getByRole('button').first()).click();
}
