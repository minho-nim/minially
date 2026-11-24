import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login } from './helpers';
import { outlineText, POST_TYPES } from '../functions/_postTypes';

test('글 종류: 고르면 경험 칸에 뼈대, 바꾸면 뼈대만 바뀌고 직접 쓴 글은 그대로, AI 초안에 종류 안내, 새로고침 유지', async ({ page }) => {
  expect(Object.values(POST_TYPES).map(t => t.label)).toEqual(['고르지 않음', '맛집', '카페', '제품 리뷰', '여행·나들이', '체험단·협찬', '뷰티', '패션', '정보', '일상']);
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  const types = page.getByRole('group', { name: '글 종류' });
  const exp = page.getByLabel(/직접 겪은 내용/);
  await types.getByRole('button', { name: '맛집' }).click();
  await expect(types.getByRole('button', { name: '맛집' })).toHaveAttribute('aria-pressed', 'true');
  await expect(exp).toHaveValue(outlineText('food'));
  await types.getByRole('button', { name: '카페' }).click();
  await expect(exp).toHaveValue(outlineText('cafe')); // 뼈대만 있으면 새 뼈대로
  await exp.fill('카페 이름·위치: 성수 토몽카페\n시그니처: 소금빵 라테 6,500원');
  await types.getByRole('button', { name: '제품 리뷰' }).click();
  await expect(exp).toHaveValue(/성수 토몽카페/); // 직접 쓴 글은 그대로
  await types.getByRole('button', { name: '카페' }).click();
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('group', { name: '글 종류' }).getByRole('button', { name: '카페' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByLabel('본문')).toHaveValue(/\(글 종류: 카페\)/);
  // 잘못된 종류는 거절
  const id = await page.evaluate(() => location.hash.split('/')[1]);
  expect(await page.evaluate(async id => (await fetch(`/api/drafts/${id}`, { method: 'PUT', body: JSON.stringify({ post_type: 'nope' }) })).status, id)).toBe(400);
  await page.evaluate(async id => { await fetch(`/api/drafts/${id}`, { method: 'DELETE' }); }, id);
});
