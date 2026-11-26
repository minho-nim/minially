import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';

test('담아 둘 글감 검사: 한 줄·100자, 메모 500자, 주소는 https만', async () => {
  const { readSavedIdea } = await import('../functions/_savedIdeas');
  expect(readSavedIdea({ text: '  동네   붕어빵\n지도 ', memo: ' 사진 3장 ', url: 'https://map.naver.com/x' })).toEqual({ text: '동네 붕어빵 지도', memo: '사진 3장', url: 'https://map.naver.com/x' });
  expect(readSavedIdea({ text: '글감' })).toEqual({ text: '글감', memo: '', url: '' });
  for (const bad of [null, { text: '' }, { text: '   ' }, { text: 3 }, { text: '가'.repeat(101) }, { text: '글감', memo: '가'.repeat(501) }, { text: '글감', url: 'http://a.com' }, { text: '글감', url: 'javascript:alert(1)' }])
    expect(typeof readSavedIdea(bad as Record<string, unknown> | null)).toBe('string');
});

test('글감 담아 두기: 담고, 한 달 계획 후보에 나오고, 원고로 만들면 비워진다', async ({ page, request }) => {
  for (const r of [await request.get('/api/ideas/saved'), await request.post('/api/ideas/saved', { data: { text: 'x' } })]) expect(r.status()).toBe(401);
  await login(page, CODE_C);
  await page.getByRole('button', { name: '글감', exact: true }).click();
  const keep = page.locator('section').filter({ has: page.getByRole('heading', { name: /글감 담아 두기/ }) });
  await keep.getByLabel('담아 둘 글감').fill('동네 붕어빵 가게 지도');
  await keep.getByRole('button', { name: '메모·주소 적기' }).click();
  await keep.getByLabel('글감 메모').fill('가게 5곳 가격 비교');
  await keep.getByLabel('참고 주소').fill('https://map.naver.com/p/search/붕어빵');
  await keep.getByRole('button', { name: '담기', exact: true }).click();
  const list = keep.getByRole('list', { name: '담아 둔 글감' });
  await expect(list).toContainText('가게 5곳 가격 비교');
  await expect(list.getByRole('link', { name: '참고 주소 열기' })).toHaveAttribute('rel', 'noopener noreferrer');

  await keep.getByLabel('담아 둘 글감').fill('겨울 캠핑 준비물');
  await keep.getByRole('button', { name: '담기', exact: true }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);
  // 잘못된 주소는 서버가 거절
  expect(await page.evaluate(async () => (await fetch('/api/ideas/saved', { method: 'POST', body: JSON.stringify({ text: '글감', url: 'http://x.com' }) })).status)).toBe(400);

  // 한 달 계획 후보에 '담아 둔 글감'으로 보인다
  const plan = page.locator('section').filter({ has: page.getByRole('heading', { name: /한 달 계획 한 번에 짜기/ }) });
  await expect(plan.getByRole('list', { name: '계획에 넣을 글감' })).toContainText('겨울 캠핑 준비물');

  // 다른 사람은 내 글감을 못 보고 못 지운다
  const other = await page.context().browser()!.newPage();
  await login(other, CODE_D);
  const id = await page.evaluate(async () => (await (await fetch('/api/ideas/saved')).json()).saved[0].id as string);
  expect(await other.evaluate(async () => (await (await fetch('/api/ideas/saved')).json()).saved.length)).toBe(0);
  expect(await other.evaluate(async i => (await fetch(`/api/ideas/saved/${i}`, { method: 'DELETE' })).status, id)).toBe(404);
  await other.close();

  // 원고로 만들면 편집 화면으로 가고 담아 둔 목록에서 빠진다
  await list.getByRole('button', { name: "'동네 붕어빵 가게 지도' 원고로 만들기" }).click();
  await expect(page.getByLabel('제목')).toHaveValue('동네 붕어빵 가게 지도');
  await expect.poll(async () => page.evaluate(async () => (await (await fetch('/api/ideas/saved')).json()).saved.map((s: { text: string }) => s.text))).toEqual(['겨울 캠핑 준비물']);

  await page.evaluate(async () => {
    for (const s of (await (await fetch('/api/ideas/saved')).json()).saved) await fetch(`/api/ideas/saved/${s.id}`, { method: 'DELETE' });
    for (const d of (await (await fetch('/api/drafts')).json()).drafts) await fetch(`/api/drafts/${d.id}`, { method: 'DELETE' });
  });
});
