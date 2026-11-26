import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login } from './helpers';

test('탭·원고가 주소에 남아 새로고침해도 그대로, 뒤로 가기는 이전 화면으로', async ({ page }) => {
  await login(page, CODE_C);
  await expect(page).toHaveURL(/#drafts$/);
  await page.getByRole('button', { name: '글감', exact: true }).click();
  await expect(page).toHaveURL(/#ideas$/);
  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  await expect(page).toHaveURL(/#calendar$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: '캘린더' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: '글감', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#drafts$/);

  // 원고 편집도 주소로: 새로고침해도 같은 원고, 뒤로 가면 목록
  await page.getByRole('button', { name: '새 원고' }).click();
  await expect(page).toHaveURL(/#draft\/[0-9a-f-]{36}$/);
  await page.getByLabel('제목').fill('주소 시험 원고');
  await page.reload();
  await expect(page.getByLabel('제목')).toHaveValue('주소 시험 원고');
  await page.goBack();
  await expect(page.getByLabel('제목')).toHaveCount(0);
  await page.goForward();
  await expect(page.getByLabel('제목')).toHaveValue('주소 시험 원고');
  page.once('dialog', d => d.accept());
  { const t = page.getByRole('button', { name: '원고 메뉴' }); if (await t.getAttribute('aria-expanded') !== 'true') await t.click(); } // 화면 정리로 메뉴·접기 안에 들어가 먼저 연다
  await page.getByRole('button', { name: '삭제' }).click();
  await expect(page).toHaveURL(/#drafts$/);
});

test('글을 쓰자마자(0.8초 전에) 새로고침해도 쓴 내용이 남는다', async ({ page }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel('제목').fill('바로 닫기 시험');
  page.once('dialog', d => d.accept()); // 저장 전이면 닫기 전에 묻는다
  await page.reload();
  await expect(page.getByLabel('제목')).toHaveValue('바로 닫기 시험');
  page.once('dialog', d => d.accept());
  { const t = page.getByRole('button', { name: '원고 메뉴' }); if (await t.getAttribute('aria-expanded') !== 'true') await t.click(); } // 화면 정리로 메뉴·접기 안에 들어가 먼저 연다
  await page.getByRole('button', { name: '삭제' }).click();
});
