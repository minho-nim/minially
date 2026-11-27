import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login, pngBytes } from './helpers';

// 확인 창 대신 '되돌리기' 알림: 지운 원고·사진은 서버 휴지통에 10분 남고, 되돌리면 그대로 돌아온다.
test('원고를 지우면 확인 창 없이 지워지고, 되돌리기로 사진까지 돌아온다', async ({ page }) => {
  await login(page, CODE_C);
  let asked = 0;
  page.on('dialog', d => { asked++; void d.dismiss(); });
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel('제목').fill('되돌리기 시험 원고');
  await page.locator('input[type=file]').setInputFiles([{ name: '빵.png', mimeType: 'image/png', buffer: pngBytes(40, 30, [200, 100, 80]) }]);
  await expect(page.getByRole('img', { name: /^사진 1:/ })).toBeVisible();
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.getByRole('button', { name: '원고 메뉴' }).click();
  await page.getByRole('button', { name: '삭제' }).click();
  const toast = page.locator('.undo-toast');
  await expect(toast).toContainText('원고를 지웠어요');
  expect(asked).toBe(0);
  await expect(page.getByRole('button', { name: /되돌리기 시험 원고/ })).toHaveCount(0);
  await toast.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('되돌리기 시험 원고');
  await expect(page.getByRole('img', { name: /^사진 1:/ })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /되돌리기 시험 원고/ }).first().click();
  await expect(page.getByRole('img', { name: /^사진 1:/ })).toBeVisible();
});

test('사진을 지우고 되돌리면 사진과 본문 [사진] 표시가 돌아온다', async ({ page }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel('제목').fill('사진 되돌리기');
  await page.locator('input[type=file]').setInputFiles([{ name: '빵.png', mimeType: 'image/png', buffer: pngBytes(40, 30, [90, 160, 80]) }]);
  await expect(page.getByRole('img', { name: /^사진 1:/ })).toBeVisible();
  await page.getByLabel('본문').fill('앞 문장\n[사진 1]\n뒤 문장');
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.getByRole('button', { name: '사진 1 지우기' }).click();
  await expect(page.getByRole('img', { name: /^사진 1:/ })).toHaveCount(0);
  await expect(page.getByLabel('본문')).not.toHaveValue(/\[사진 1\]/);
  await page.locator('.undo-toast').getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByRole('img', { name: /^사진 1:/ })).toBeVisible();
  await expect(page.getByLabel('본문')).toHaveValue(/\[사진 1\]/);
});

test('남의 휴지통은 되돌릴 수 없다', async ({ page, browser }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel('제목').fill('C의 지운 원고');
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.getByRole('button', { name: '원고 메뉴' }).click();
  await page.getByRole('button', { name: '삭제' }).click();
  await expect(page.locator('.undo-toast')).toBeVisible();
  const id = await page.evaluate(async () => {
    // 휴지통에 들어간 원고 id는 목록에서 빠졌으므로, 방금 만든 원고 id를 기록에서 찾는다
    return (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map(e => e.name).reverse().map(u => u.match(/\/api\/drafts\/([0-9a-f-]{36})$/)?.[1]).find(Boolean) ?? '';
  });
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  const other = await browser.newPage();
  await login(other, CODE_D);
  const res = await other.evaluate(async (draftId) => (await fetch(`/api/trash/${draftId}/restore`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, id);
  expect(res).toBe(404);
  const bad = await other.evaluate(async () => (await fetch('/api/trash/not-an-id/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status);
  expect(bad).toBe(404);
  // 주인은 되돌릴 수 있다
  await page.locator('.undo-toast').getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('C의 지운 원고');
});

test('빈 화면은 할 일 하나와 저장되지 않는 예시를 보여 준다', async ({ page }) => {
  await login(page, CODE_D);
  await page.getByRole('button', { name: '협찬', exact: true }).click();
  await expect(page.getByText('진행 중인 협찬이 없어요')).toBeVisible();
  await page.getByRole('button', { name: '예시 보기' }).first().click();
  await expect(page.getByText('예시 · 저장되지 않아요')).toBeVisible();
  await page.getByRole('button', { name: '첫 협찬 적기' }).click();
  await expect(page.getByLabel(/업체/).first()).toBeVisible();
});

test('휴대폰에서는 ⋯ 메뉴가 아래 시트로 열리고 바깥을 누르면 닫힌다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await login(page, CODE_D);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByRole('button', { name: '원고 메뉴' }).click();
  const sheet = page.locator('.more-items');
  await expect(sheet).toBeVisible();
  // 올라오는 움직임이 끝난 뒤 화면 아래에 딱 붙고 폭을 다 채운다
  await expect.poll(async () => { const b = await sheet.boundingBox(); return b ? [Math.round(b.y + b.height), Math.round(b.width)] : null; }).toEqual([800, 390]);
  await page.mouse.click(195, 40);
  await expect(sheet).toHaveCount(0);
});
