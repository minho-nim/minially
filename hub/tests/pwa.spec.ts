import { expect, test } from '@playwright/test';

test('앱처럼 설치(PWA): 매니페스트·아이콘·서비스 워커 파일이 있다', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.short_name).toBe('미니허브');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((i: { purpose: string }) => i.purpose)).toEqual(['any', 'any', 'maskable']);
  for (const icon of manifest.icons) {
    const res = await request.get(icon.src);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  }
  const sw = await (await request.get('/sw.js')).text();
  expect(sw).toContain('precache');
  expect(sw).not.toMatch(/registerRoute\([^)]*api/); // /api 응답은 저장하지 않음
});
