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

test('빠른 찾기(Ctrl K): 글자로 화면·원고를 찾아 Enter로 열고, Esc로 닫는다', async ({ page }) => {
  await login(page, CODE_D);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel('제목').fill('소금빵 가게 후기');
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: '빠른 찾기' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('빠른 찾기 글자').fill('캘린');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#calendar$/);
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: '빠른 찾기' }).click();
  await dialog.getByLabel('빠른 찾기 글자').fill('소금빵');
  await expect(dialog.getByRole('option')).toHaveText([/소금빵 가게 후기/]);
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('제목')).toHaveValue('소금빵 가게 후기');
  await page.keyboard.press('Control+k');
  await dialog.getByLabel('빠른 찾기 글자').fill('없는말없는말');
  await expect(dialog).toContainText('찾은 것이 없어요');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('첫 안내 3단계: 원고가 없을 때 가운데 칸에만 보이고, 넘겨 보다 다 보면 다시 안 보인다', async ({ page }) => {
  // 다른 시험이 만든 원고와 상관없이 '원고 없음' 상태를 본다(목록 응답만 비움)
  await page.route('**/api/drafts', route => (route.request().method() === 'GET' ? route.fulfill({ json: { drafts: [], more: false } }) : route.continue()));
  await login(page, CODE_D);
  await expect(page.getByRole('region', { name: '원고를 하나 시작해요' })).toBeVisible();
  await page.getByRole('button', { name: '다음 안내' }).click();
  await expect(page.getByRole('heading', { name: '밑줄을 따라 다듬어요' })).toBeVisible();
  await page.getByRole('button', { name: '다음 안내' }).click();
  await expect(page.getByRole('heading', { name: '올릴 날을 정하고 직접 올려요' })).toBeVisible();
  await page.getByRole('button', { name: '다 봤어요' }).click();
  await expect(page.locator('.first-steps')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: '사진과 경험으로 블로그 원고 만들기' })).toBeVisible();
  await expect(page.locator('.first-steps')).toHaveCount(0);
});
