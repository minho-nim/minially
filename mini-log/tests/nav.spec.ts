import { expect, test } from '@playwright/test';
import { CODE_D } from '../playwright.config';
import { login } from './helpers';

test('넓은 화면 메뉴: 묶음 이름 아래 한 줄에 하나, 지금 화면 표시, 블로그 안에서 구조로 바꿔 보기, 설정은 맨 아래', async ({ page }) => {
  await login(page, CODE_D);
  const nav = page.getByRole('navigation', { name: '미니로그 메뉴' });
  await expect(nav.getByRole('group')).toHaveText([/만들기.*원고.*글감.*문체/, /일정 · 협찬.*캘린더.*협찬.*메일/, /분석.*대시보드.*월간보고.*블로그/]);
  await nav.getByRole('button', { name: '블로그', exact: true }).click();
  await expect(nav.getByRole('button', { name: '블로그', exact: true })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('group', { name: '블로그 화면 고르기' }).getByRole('button', { name: '블로그 구조' }).click();
  await expect(page).toHaveURL(/#structure$/);
  await expect(page.getByRole('heading', { name: '블로그 구조' })).toBeVisible();
  await expect(nav.getByRole('button', { name: '블로그', exact: true })).toHaveAttribute('aria-current', 'true'); // 구조도 '블로그' 칸에 불
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(page).toHaveURL(/#settings$/);
  await expect(page.locator('.m-tabs')).toBeHidden(); // 넓은 화면에는 아래 탭 없음
});

test('휴대폰 메뉴: 아래 탭 4개·묶음 안 칩·새 원고 둥근 버튼, 원고를 쓰는 동안은 아래 탭을 숨긴다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, CODE_D);
  const tabs = page.getByRole('navigation', { name: '미니로그 묶음' });
  await expect(tabs.getByRole('button')).toHaveText(['만들기', '일정', '협찬', '분석']);
  await expect(page.getByRole('navigation', { name: '미니로그 메뉴' })).toBeHidden();
  await tabs.getByRole('button', { name: '협찬 묶음' }).click();
  await expect(page).toHaveURL(/#campaigns$/);
  const chips = page.getByRole('navigation', { name: '협찬 메뉴' });
  await chips.getByRole('button', { name: '메일', exact: true }).click();
  await expect(page).toHaveURL(/#mail$/);
  await tabs.getByRole('button', { name: '일정 묶음' }).click();
  await expect(page).toHaveURL(/#calendar$/);
  await page.getByRole('button', { name: '설정' }).click();
  await expect(page).toHaveURL(/#settings$/);
  await tabs.getByRole('button', { name: '만들기 묶음' }).click();
  await page.getByRole('button', { name: '새 원고' }).click();
  await expect(page.getByLabel('제목')).toBeVisible();
  await expect(tabs).toBeHidden();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(0);
});
