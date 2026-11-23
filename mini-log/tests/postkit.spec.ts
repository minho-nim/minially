import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login, pngBytes } from './helpers';
import { fullText, pasteBody, photoFileName } from '../src/publishKit';

test('올리기 글·사진 이름 만들기', () => {
  expect(pasteBody('첫 문단\n[사진 1]\n둘째 [사진2] 끝')).toBe('첫 문단\n📷 사진 1\n둘째 📷 사진 2 끝');
  expect(fullText(' 제목 ', '본문 [사진 1]', ['카페', '빵'])).toBe('제목\n\n본문 📷 사진 1\n\n#카페 #빵');
  expect(fullText('', '본문', [])).toBe('본문');
  expect(photoFileName(0, Date.parse('2026-11-23T16:00:00Z'))).toBe('minilog_20261124_01.jpg'); // 한국 시간 기준 날짜
  expect(photoFileName(11, Date.parse('2026-11-23T10:00:00Z'))).toBe('minilog_20261123_12.jpg');
});

test('올리기 보조: 한 번에·따로 복사, 사진 번호 붙여 받기, 주소 넣어 게시 완료', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.locator('input[type=file]').setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: pngBytes(40, 30, [200, 90, 80]) },
    { name: 'b.png', mimeType: 'image/png', buffer: pngBytes(30, 40, [90, 200, 80]) },
  ]);
  await expect(page.getByRole('img', { name: /^사진 2:/ })).toBeVisible();
  await page.getByLabel('제목').fill('올리기 시험 원고');
  await page.getByLabel('본문').fill('첫 문단\n[사진 1]\n두 번째 문단\n[사진 2]');
  await page.getByLabel('해시태그').fill('#카페 #시험');
  await expect(page.getByText('저장됨')).toBeVisible();
  const kit = page.locator('.post-kit');
  const clip = () => page.evaluate(() => navigator.clipboard.readText());

  await kit.getByRole('button', { name: '한 번에 복사' }).click();
  await expect(kit.getByRole('button', { name: '복사됨 ✓' })).toBeVisible();
  expect(await clip()).toBe('올리기 시험 원고\n\n첫 문단\n📷 사진 1\n두 번째 문단\n📷 사진 2\n\n#카페 #시험');
  await expect(page.getByRole('status').filter({ hasText: '사진 n 자리에' })).toBeVisible();
  await kit.getByRole('button', { name: '제목', exact: true }).click();
  expect(await clip()).toBe('올리기 시험 원고');
  await kit.getByRole('button', { name: '본문', exact: true }).click();
  expect(await clip()).toBe('첫 문단\n📷 사진 1\n두 번째 문단\n📷 사진 2');
  await kit.getByRole('button', { name: '해시태그', exact: true }).click();
  expect(await clip()).toBe('#카페 #시험');

  // 사진: 글 순서대로 번호 붙은 파일 2개
  const names: string[] = [];
  page.on('download', d => { names.push(d.suggestedFilename()); });
  await kit.getByRole('button', { name: '번호 붙여 받기(2장)' }).click();
  await expect(page.getByText('사진 2장을 받았어요')).toBeVisible();
  await expect.poll(() => names.length).toBe(2);
  expect(names).toEqual([photoFileName(0), photoFileName(1)]);
  await expect(kit.getByRole('link', { name: /네이버 블로그 글쓰기/ })).toHaveAttribute('href', 'https://blog.naver.com/GoBlogWrite.naver');

  // 올린 뒤 주소 → 게시 완료
  await page.getByLabel('게시한 글 주소').fill('https://blog.naver.com/myblog/223999999999');
  await page.getByRole('button', { name: '게시 완료' }).click();
  await expect(page.getByText(/^게시 완료 ·/)).toBeVisible();
  await expect(page.locator('.post-kit')).toHaveCount(0);

  // 다른 시험(빈 목록 확인)에 영향이 없게 지운다
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: '삭제' }).click();
});
