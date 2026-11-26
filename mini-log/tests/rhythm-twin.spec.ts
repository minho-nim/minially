import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login } from './helpers';
import { similarTitle } from '../src/DraftCheck';

test('재탕 경고: 낱말이 많이 겹치는 다른 원고 제목만 찾는다', () => {
  expect(similarTitle('성수동 소금빵 맛집 후기', ['성수 소금빵 맛집 후기 2탄', '연남동 카페'])).toBe('성수 소금빵 맛집 후기 2탄');
  expect(similarTitle('성수동 소금빵 맛집 후기', ['연남동 파스타 맛집', '제주 여행'])).toBeNull();
  expect(similarTitle('후기', ['후기'])).toBeNull(); // 낱말 하나뿐이면 보지 않음
});

test('원고 점검에 재탕 경고가 뜨고, 목록 위에 이번 주 게시 수가 보인다', async ({ page }) => {
  await login(page, CODE_C);
  for (const [i, title] of ['동네 빵집 소금빵 솔직 후기', '동네 빵집 소금빵 후기 2편'].entries()) {
    const list = page.getByRole('navigation', { name: '원고' }).getByRole('button');
    const before = i === 0 ? 0 : await list.count();
    await page.getByRole('button', { name: '새 원고' }).click();
    if (i) await expect(list).toHaveCount(before + 1); // 새 원고 화면으로 바뀐 뒤에 적는다(앞 원고에 적히지 않게)
    await expect(page.getByLabel('제목')).toHaveValue('');
    await page.getByLabel('제목').fill(title);
    await expect(page.getByText('저장됨')).toBeVisible();
  }
  await expect(page.getByLabel('이번 주 게시')).toContainText(/이번 주 게시 \d+편 · 권장 3~5편/);
  await expect(page.getByText(/비슷한 제목의 다른 원고 없음/)).toBeVisible();
  await expect(page.getByText(/‘동네 빵집 소금빵 솔직 후기’과 많이 겹쳐요/)).toBeVisible();
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '삭제' }).click();
  await page.getByRole('navigation', { name: '원고' }).getByRole('button', { name: /동네 빵집 소금빵 솔직 후기/ }).click();
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByRole('navigation', { name: '원고' }).getByRole('button', { name: /동네 빵집 소금빵/ })).toHaveCount(0);
});
