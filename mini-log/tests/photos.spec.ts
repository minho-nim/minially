import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login, pngBytes } from './helpers';

const files = [
  { name: '빵집.png', mimeType: 'image/png', buffer: pngBytes(64, 48, [230, 120, 90]) },
  { name: '소금빵.png', mimeType: 'image/png', buffer: pngBytes(48, 64, [240, 200, 120]) },
];

test('사진 여러 장을 올리고, AI가 사진과 함께 초안을 쓰고, 사진을 지운다', async ({ page }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.locator('input[type=file]').setInputFiles(files);
  await expect(page.getByRole('img', { name: /^사진 2:/ })).toBeVisible();
  await expect(page.getByText('2/20장')).toBeVisible();
  // 브라우저에서 줄여 JPG로 올렸는지(원본 PNG가 아님)
  const type = await page.evaluate(async () => (await fetch((document.querySelector('.photo img') as HTMLImageElement).src)).headers.get('content-type'));
  expect(type).toBe('image/jpeg');
  await expect(page.getByText('AI가 사진 2장도 함께 보고 써요')).toBeVisible();
  await page.getByLabel(/직접 겪은 내용/).fill('토요일 오후에 동네 빵집에 다녀왔어요. 소금빵이 맛있었어요.');
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('가짜 Gemini가 쓴 제목(사진 2장)');
  await expect(page.getByLabel('본문')).toHaveValue(/\[사진 1\]\n\[사진 2\]/);
  await page.reload();
  await expect(page.getByRole('button', { name: /사진 2 ·/ })).toBeVisible(); // 목록에 사진 수
  await page.getByRole('button', { name: /가짜 Gemini가 쓴 제목/ }).first().click() /* 새로고침해도 원고가 열려 있어 목록 쪽(첫째)을 누름 */;
  await expect(page.getByRole('img', { name: /^사진 2:/ })).toBeVisible();
  // 순서 바꾸기: 사진 2(소금빵)를 앞으로 → 본문 번호도 맞춰짐, 새로고침해도 유지
  await page.getByRole('button', { name: '사진 2 앞으로' }).click();
  await expect(page.getByRole('img', { name: /^사진 1: 소금빵/ })).toBeVisible();
  await expect(page.getByLabel('본문')).toHaveValue(/\[사진 2\]\n\[사진 1\]/);
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /가짜 Gemini가 쓴 제목/ }).first().click() /* 새로고침해도 원고가 열려 있어 목록 쪽(첫째)을 누름 */;
  await expect(page.getByRole('img', { name: /^사진 1: 소금빵/ })).toBeVisible();
  await expect(page.getByLabel('본문')).toHaveValue(/\[사진 2\]\n\[사진 1\]/);
  // 지우기: 사진 1(소금빵)을 지우면 그 표시는 사라지고 빵집이 사진 1이 됨
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: '사진 1 지우기' }).click();
  await expect(page.getByText('1/20장')).toBeVisible();
  await expect(page.getByRole('img', { name: /^사진 1: 빵집/ })).toBeVisible();
  await expect(page.getByLabel('본문')).toHaveValue('첫 문단입니다.\n[사진 1]\n두 번째 문단입니다. [작성자 확인 필요]');
});

test('게시 주소를 넣으면 게시 완료, 사진 삭제 예정이 보이고 취소할 수 있다', async ({ page }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.locator('input[type=file]').setInputFiles(files[0]);
  await expect(page.getByText('1/20장')).toBeVisible();
  await page.getByLabel('게시한 글 주소').fill('javascript:alert(1)');
  await page.getByRole('button', { name: '게시 완료' }).click();
  await expect(page.getByRole('alert')).toContainText('https://로 시작하는 주소');
  await page.getByLabel('게시한 글 주소').fill('https://blog.naver.com/test/123');
  await page.getByRole('button', { name: '게시 완료' }).click();
  await expect(page.getByRole('link', { name: 'https://blog.naver.com/test/123' })).toBeVisible();
  await expect(page.locator('.badge')).toHaveText('게시됨');
  await expect(page.getByText(/게시 후 30일이 지나면 사진이 지워져요/)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /게시됨/ }).first().click();
  await expect(page.getByRole('link', { name: 'https://blog.naver.com/test/123' })).toBeVisible();
  await page.getByRole('button', { name: '게시 취소' }).click();
  await expect(page.locator('.badge')).toHaveText('승인됨');
  await expect(page.getByText(/게시 후 30일이 지나면/)).toHaveCount(0);
});

test('남의 사진은 보거나 지울 수 없고, 사진이 아닌 파일은 거절한다', async ({ browser }) => {
  const c = await browser.newPage();
  await login(c, CODE_C);
  const ids = await c.evaluate(async png => {
    const draft = (await (await fetch('/api/drafts', { method: 'POST' })).json()).draft.id as string;
    const photo = (await (await fetch(`/api/drafts/${draft}/photos`, { method: 'POST', body: new Uint8Array(png) })).json()).photo.id as string;
    const text = (await fetch(`/api/drafts/${draft}/photos`, { method: 'POST', body: new TextEncoder().encode('<svg onload=alert(1)>') })).status;
    return { draft, photo, text };
  }, [...pngBytes(8, 8, [1, 2, 3])]);
  expect(ids.text).toBe(415);
  const d = await browser.newPage();
  await login(d, CODE_D);
  const statuses = await d.evaluate(async ({ draft, photo }) => [
    (await fetch(`/api/photos/${photo}`)).status,
    (await fetch(`/api/drafts/${draft}/photos`)).status,
    (await fetch(`/api/photos/${photo}`, { method: 'DELETE' })).status,
    (await fetch(`/api/drafts/${draft}/photos`, { method: 'POST', body: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0]) })).status,
  ], ids);
  expect(statuses).toEqual([404, 404, 404, 404]);
  expect(await c.evaluate(async id => (await fetch(`/api/photos/${id}`)).status, ids.photo)).toBe(200); // C의 사진은 그대로
  const anon = await (await browser.newContext()).newPage();
  await anon.goto('/version.json');
  expect(await anon.evaluate(async id => (await fetch(`/api/photos/${id}`)).status, ids.photo)).toBe(401);
});
