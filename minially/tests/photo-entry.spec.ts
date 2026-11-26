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

test('글로 넣기: 붙여넣은 문자를 이 기기 안에서 읽어 후보로 보여 주고(서버로 보내지 않음), 고른 것만 등록한다', async ({ page }) => {
  const sent: string[] = [];
  page.on('request', r => { if (r.url().includes('/api/photo-schedule')) sent.push(r.url()); });
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  await page.getByRole('dialog', { name: '새 일정' }).getByRole('button', { name: '사진으로 일정 넣기' }).click();
  const sheet = page.getByRole('dialog', { name: '사진으로 일정 넣기' });
  await expect(sheet).toContainText('구글 무료 AI(Gemini)로 읽어요');
  await expect(sheet.getByRole('button', { name: '글에서 찾기' })).toBeDisabled();
  await sheet.getByLabel('문자·메일 붙여넣기').fill('[밝은미소치과] 홍길동님 12월 2일 오후 2시 30분 진료 예약되었습니다.\n12월 9일 오후 4시 재방문');
  await sheet.getByRole('button', { name: '글에서 찾기' }).click();
  await expect(sheet.getByRole('heading', { name: '찾은 일정 2개' })).toBeVisible();
  const rows = sheet.locator('[data-photo-event]');
  await expect(rows.nth(0).getByLabel('일정 제목')).toHaveValue('밝은미소치과 진료');
  await expect(rows.nth(0).getByLabel('시작 시간')).toHaveValue('14:30');
  await rows.nth(1).getByRole('checkbox').uncheck();
  await sheet.getByRole('button', { name: '1개 등록' }).click();
  await expect(sheet).toHaveCount(0);
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(r => { const q = indexedDB.open('DayFlowDB'); q.onsuccess = () => r(q.result); });
    const all = await new Promise<{ title: string; date: string; startTime?: string }[]>(r => { const q = db.transaction('schedules').objectStore('schedules').getAll(); q.onsuccess = () => r(q.result); });
    db.close(); return all.filter(s => s.title.includes('치과')).map(s => [s.title, s.date.slice(5), s.startTime]);
  });
  expect(saved).toEqual([['밝은미소치과 진료', '12-02', '14:30']]);
  expect(sent).toEqual([]);
});

test('글로 넣기: 못 찾으면 글 고치기·AI로 다시 읽기를 주고, AI는 누를 때만 쓴다(로그인 전이면 안내)', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  await page.getByRole('dialog', { name: '새 일정' }).getByRole('button', { name: '사진으로 일정 넣기' }).click();
  const sheet = page.getByRole('dialog', { name: '사진으로 일정 넣기' });
  await sheet.getByLabel('문자·메일 붙여넣기').fill('다들 고마워요');
  await sheet.getByRole('button', { name: '글에서 찾기' }).click();
  await expect(sheet).toContainText('글에서 일정을 못 찾았어요');
  await expect(sheet).toContainText('구글 서비스 개선에 쓰일 수 있어요');
  await sheet.getByRole('button', { name: '글 고치기' }).click();
  await expect(sheet.getByLabel('문자·메일 붙여넣기')).toHaveValue('다들 고마워요');
  await sheet.getByRole('button', { name: '글에서 찾기' }).click();
  await sheet.getByRole('button', { name: 'AI로 다시 읽기' }).click();
  await expect(sheet.getByRole('alert')).toContainText('동기화 코드로 로그인하면 쓸 수 있어요');
  await expect(sheet.getByRole('button', { name: '글 고치기' })).toBeVisible();
});

test('공유로 받은 글(문자·메일)이 있으면 앱을 열 때 꺼내 기기 안에서 읽고, 캐시와 주소의 표시는 지운다', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.evaluate(async () => {
    await (await caches.open('minially-share')).put('shared-text', new Response('모레 오전 11시 은행 상담', { headers: { 'content-type': 'text/plain' } }));
  });
  await page.goto('/?share-photo=text');
  const sheet = page.getByRole('dialog', { name: '사진으로 일정 넣기' });
  await expect(sheet.getByRole('heading', { name: '찾은 일정 1개' })).toBeVisible();
  await expect(sheet.locator('[data-photo-event]').getByLabel('일정 제목')).toHaveValue('은행 상담');
  expect(page.url()).not.toContain('share-photo');
  expect(await page.evaluate(async () => !!(await (await caches.open('minially-share')).match('shared-text')))).toBe(false);
});

test('글로 넣기: 내 예전 일정을 보고 카테고리를 정하고, 두 번 넘게 쓴 제목으로 맞추며 원래대로도 된다', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.evaluate(async () => {
    const path = '/src/db/indexedDB.ts';
    await (await import(path)).importAllData({ categories: [{ id: 'health', name: '병원', color: '#CF8FA8' }, { id: 'work', name: '업무', color: '#94BED9' }],
      schedules: [{ id: 'p1', title: '치과 정기 검진', date: '2026-10-01', category: 'health', completed: false }, { id: 'p2', title: '치과 정기 검진', date: '2026-11-01', category: 'health', completed: false }, { id: 'p3', title: '팀 회의', date: '2026-11-02', category: 'work', completed: false }] });
  });
  await page.reload(); await page.getByRole('button', { name: '일정 등록', exact: true }).waitFor();
  await page.getByRole('button', { name: '일정 등록', exact: true }).click();
  await page.getByRole('dialog', { name: '새 일정' }).getByRole('button', { name: '사진으로 일정 넣기' }).click();
  const sheet = page.getByRole('dialog', { name: '사진으로 일정 넣기' });
  await sheet.getByLabel('문자·메일 붙여넣기').fill('[밝은미소치과] 12월 2일 오후 2시 진료 예약되었습니다.');
  await sheet.getByRole('button', { name: '글에서 찾기' }).click();
  const row = sheet.locator('[data-photo-event]').first();
  await expect(row.getByLabel('카테고리')).toHaveValue('health');
  await expect(row).toContainText('카테고리 추천');
  await expect(row.getByLabel('일정 제목')).toHaveValue('치과 정기 검진'); // 두 번 쓴 제목 → 그 제목으로
  await row.getByRole('button', { name: '원래대로' }).click();
  await expect(row.getByLabel('일정 제목')).toHaveValue('밝은미소치과 진료');
  await row.getByRole('button', { name: /예전처럼/ }).click();
  await expect(row.getByLabel('일정 제목')).toHaveValue('치과 정기 검진');
});
