import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login, pngBytes } from './helpers';

test('블로그 아이디로 RSS 글을 가져오고, 게시 원고와 짝짓고, 통계 캡처·직접 입력으로 조회수 순위를 만든다', async ({ page }) => {
  await login(page, CODE_C);
  // 미니로그에서 게시 완료한 원고(주소가 RSS 글과 같음)
  await page.evaluate(async () => {
    const d = (await (await fetch('/api/drafts', { method: 'POST' })).json()).draft;
    await fetch(`/api/drafts/${d.id}`, { method: 'PUT', body: JSON.stringify({ title: '소금빵 원고', status: 'published', published_url: 'https://blog.naver.com/PostView.naver?blogId=myblog&logNo=223000000001' }) });
  });
  await page.getByRole('button', { name: '블로그', exact: true }).click();
  await page.getByLabel('블로그 아이디').fill('nobody');
  await page.getByRole('button', { name: '연결하고 가져오기' }).click();
  await expect(page.getByRole('alert')).toHaveText('그 아이디의 블로그를 찾지 못했어요.');
  await page.getByLabel('블로그 아이디').fill('https://blog.naver.com/myblog');
  await page.getByRole('button', { name: '다시 가져오기' }).click();
  await expect(page.getByRole('status')).toContainText('글 3개(새로 3개)를 가져왔어요. 미니로그 원고 1개와 짝지었어요.');
  await expect(page.getByLabel('블로그 아이디')).toHaveValue('myblog');
  await expect(page.locator('.post').first()).toContainText('앰플 한 달 사용기'); // 최신순
  await expect(page.locator('.post', { hasText: '동네 빵집 소금빵 후기' })).toContainText('미니로그 원고');

  // 통계 캡처 → AI가 읽은 숫자 기록(없는 글은 못 찾음으로 알림)
  await page.locator('input[type=file]').setInputFiles({ name: 'stats.png', mimeType: 'image/png', buffer: pngBytes(30, 30, [250, 250, 250]) });
  await expect(page.getByRole('status')).toContainText('글 2개의 숫자를 읽어 기록했어요');
  await expect(page.getByRole('status')).toContainText('없는 글 제목');
  await expect(page.locator('.post', { hasText: '동네 빵집 소금빵 후기' })).toContainText('1,520');

  // 직접 적기
  await page.getByRole('button', { name: '앰플 한 달 사용기 숫자 적기' }).click();
  await page.getByLabel('조회', { exact: true }).fill('2,400');
  await page.getByLabel('공감', { exact: true }).fill('60');
  await page.getByRole('button', { name: '저장' }).click();
  await page.getByRole('tab', { name: '조회수순' }).click();
  await expect(page.locator('.post').first()).toContainText('앰플 한 달 사용기');
  await expect(page.getByLabel('조회수 TOP 3').locator('li').first()).toContainText('앰플 한 달 사용기');

  // 다시 가져와도 숫자는 그대로, 글은 늘지 않음
  await page.getByRole('button', { name: '다시 가져오기' }).click();
  await expect(page.getByRole('status')).toContainText('글 3개(새로 0개)');
  await page.reload();
  await page.getByRole('button', { name: '대시보드', exact: true }).click();
  await expect(page.locator('section', { hasText: '조회수 TOP 3' }).locator('li').first()).toContainText('앰플 한 달 사용기');
});

test('블로그 기록은 본인만 보고, 잘못된 값은 거절한다', async ({ browser }) => {
  const d = await browser.newPage();
  await login(d, CODE_D);
  const r = await d.evaluate(async () => ({
    blog: await (await fetch('/api/blog')).json(),
    badId: (await fetch('/api/blog', { method: 'PUT', body: JSON.stringify({ blog_id: '<script>' }) })).status,
    syncNoId: (await fetch('/api/blog/sync', { method: 'POST' })).status,
    otherPost: (await fetch('/api/blog/posts/223000000001', { method: 'PUT', body: JSON.stringify({ views: 1 }) })).status,
    statsNoPosts: (await fetch('/api/blog/stats', { method: 'POST', body: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0]) })).status,
  }));
  expect(r.blog).toEqual({ blog_id: null, synced_at: null, posts: [] });
  expect([r.badId, r.syncNoId, r.otherPost, r.statsNoPosts]).toEqual([400, 400, 404, 400]);
  const c = await browser.newPage();
  await login(c, CODE_C);
  const bad = await c.evaluate(async () => (await fetch('/api/blog/posts/223000000001', { method: 'PUT', body: JSON.stringify({ views: -5 }) })).status);
  expect(bad).toBe(400);
});
