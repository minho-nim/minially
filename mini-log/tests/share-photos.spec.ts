import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login, pngBytes } from './helpers';

test('공유 대상: 매니페스트는 사진도 받는 POST, 서비스 워커 없이 온 공유는 글·주소만 넘기고 사진은 못 받았다고 표시한다', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.share_target).toMatchObject({ action: '/share', method: 'POST', enctype: 'multipart/form-data' });
  expect(manifest.share_target.params.files[0]).toMatchObject({ name: 'photos', accept: ['image/*'] });
  expect(await (await request.get('/sw.js')).text()).toContain('share-target-sw.js');
  const res = await request.post('/share', { multipart: { url: 'https://example.com/campaign/1', title: '공고', photos: { name: 'a.png', mimeType: 'image/png', buffer: pngBytes(4, 4, [255, 0, 0]) } }, maxRedirects: 0 });
  expect(res.status()).toBe(303);
  const to = new URL(res.headers().location, 'http://x');
  expect(to.searchParams.get('url')).toBe('https://example.com/campaign/1');
  expect(to.searchParams.get('share-photos')).toBe('missing');
});

test('공유로 받은 사진을 새 원고에 넣고 원고를 열며, 캐시를 지운다', async ({ page }) => {
  await login(page, CODE_C);
  const png = [...pngBytes(40, 30, [200, 120, 80])];
  await page.evaluate(async bytes => {
    const cache = await caches.open('minilog-share');
    for (const i of [0, 1]) await cache.put(`shared-photo-${i}`, new Response(new Blob([new Uint8Array(bytes)], { type: 'image/png' }), { headers: { 'content-type': 'image/png', 'x-file-name': `share-${i}.png` } }));
  }, png);
  await page.goto('/?share-photos=2');
  const dialog = page.getByRole('dialog', { name: '공유한 사진 넣기' });
  await expect(dialog).toContainText('공유한 사진 2장');
  await expect(dialog.getByLabel('어느 원고에 넣을까요?')).toHaveValue('new');
  await dialog.getByRole('button', { name: '2장 넣기' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('list', { name: '올린 사진' }).getByRole('img')).toHaveCount(2);
  expect(await page.evaluate(async () => (await (await caches.open('minilog-share')).keys()).length)).toBe(0);
  expect(page.url()).not.toContain('share-photos');
  const opened = await page.evaluate(() => location.hash);
  page.once('dialog', d => d.accept());
  { const t = page.getByRole('button', { name: '원고 메뉴' }); if (await t.getAttribute('aria-expanded') !== 'true') await t.click(); } // 화면 정리로 메뉴·접기 안에 들어가 먼저 연다
  await page.getByRole('button', { name: '삭제' }).click();
  await expect.poll(() => page.evaluate(() => location.hash)).not.toBe(opened); // 만든 원고는 지움
});
