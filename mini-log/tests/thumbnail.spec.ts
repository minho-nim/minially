import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { readFile } from 'node:fs/promises';
import { login, pngBytes } from './helpers';

/** JPG 머리(SOF)에서 가로·세로 읽기 */
function jpegSize(b: Buffer): [number, number] {
  let i = 2;
  while (i < b.length) {
    const marker = b[i + 1], len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return [0, 0];
}

test('썸네일: 틀 2개·글자 더하기·끌어 옮기기·비율 바꾸기 → JPG 받기(1080 폭)', async ({ page }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.locator('input[type=file]').first().setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: pngBytes(80, 60, [200, 120, 80]) },
    { name: 'b.png', mimeType: 'image/png', buffer: pngBytes(60, 80, [80, 160, 200]) },
  ]);
  await expect(page.getByRole('img', { name: /^사진 2:/ })).toBeVisible();
  await page.getByLabel('제목').fill('성수 소금빵 맛집');
  await page.getByRole('button', { name: '썸네일 만들기' }).click();
  const preview = page.getByRole('img', { name: /^썸네일 미리보기/ });
  await expect(preview).toHaveAttribute('aria-label', '썸네일 미리보기: 성수 소금빵 맛집');
  await page.getByRole('button', { name: '틀: 가운데 큰 글씨' }).click();
  await expect(preview).toHaveAttribute('aria-label', '썸네일 미리보기: 성수 소금빵 맛집 / 솔직 후기');
  await page.getByRole('button', { name: '+ 글자' }).click();
  await page.getByLabel('글자 내용').fill('12월 신메뉴');
  await expect(preview).toHaveAttribute('aria-label', /12월 신메뉴$/);
  // 새 글자(위쪽 20%)를 끌어서 아래로 옮긴다
  const box = (await preview.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('group', { name: '비율' }).getByRole('button', { name: '4:3' }).click();
  await page.getByRole('group', { name: '사진 고르기' }).getByRole('button', { name: '사진 2' }).click();
  await page.screenshot({ path: 'test-results/thumbnail.png' });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '썸네일 받기(JPG)' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^minilog_thumbnail_\d{8}\.jpg$/);
  const buf = await readFile((await download.path())!);
  expect(jpegSize(buf)).toEqual([1080, 810]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await page.evaluate(async () => { for (const d of (await (await fetch('/api/drafts')).json()).drafts) await fetch(`/api/drafts/${d.id}`, { method: 'DELETE' }); });
});
