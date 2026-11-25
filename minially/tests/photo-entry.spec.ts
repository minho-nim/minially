import { test, expect } from '@playwright/test';

// 들어가는 곳 ①②③: 새 일정 머리줄, 날짜 시트 빠른 입력, 안드로이드 공유(서비스 워커가 둔 사진을 앱이 꺼냄)
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test('새 일정 머리줄과 날짜 시트 빠른 입력에서 사진으로 일정 넣기를 열고, 로그인 전이면 쓸 수 없다고 알린다', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '새 일정' });
  await expect(modal.getByRole('button', { name: '사진으로 일정 넣기' })).toBeVisible();
  await modal.getByRole('button', { name: '사진으로 일정 넣기' }).click();
  const sheet = page.getByRole('dialog', { name: '사진으로 일정 넣기' });
  await expect(sheet.getByRole('button', { name: '사진 고르기' })).toBeVisible();
  await expect(modal).toHaveCount(0);
  await sheet.getByLabel('일정이 적힌 사진').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from(await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 20; c.height = 10; const b = await new Promise<Blob>(r => c.toBlob(x => r(x!), 'image/png')); return [...new Uint8Array(await b.arrayBuffer())]; })) });
  await expect(sheet.getByRole('alert')).toContainText('동기화 코드로 로그인하면 쓸 수 있어요');
  await sheet.getByRole('button', { name: '사진으로 일정 넣기 닫기' }).click();
  await expect(sheet).toHaveCount(0);

  await page.locator('[data-calendar-date]').nth(24).click();
  await page.getByRole('dialog', { name: '날짜별 일정' }).getByRole('button', { name: '일정 등록하기', exact: true }).click();
  const quick = page.getByRole('button', { name: '사진으로 일정 넣기' });
  await expect(quick).toBeVisible();
  const box = (await quick.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
  await quick.click();
  await expect(sheet.getByRole('button', { name: '사진 고르기' })).toBeVisible();
});

test('공유로 받은 사진이 있으면 앱을 열 때 꺼내 바로 읽고, 캐시와 주소의 표시는 지운다', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 20; c.height = 10;
    const blob = await new Promise<Blob>(r => c.toBlob(x => r(x!), 'image/png'));
    await (await caches.open('minially-share')).put('shared-photo', new Response(blob, { headers: { 'content-type': 'image/png' } }));
  });
  await page.goto('/?share-photo=1');
  const sheet = page.getByRole('dialog', { name: '사진으로 일정 넣기' });
  await expect(sheet.getByRole('alert')).toContainText('동기화 코드로 로그인하면 쓸 수 있어요'); // 사진을 꺼내 읽기를 시도함(로그인 전)
  expect(page.url()).not.toContain('share-photo');
  expect(await page.evaluate(async () => !!(await (await caches.open('minially-share')).match('shared-photo')))).toBe(false);
});
