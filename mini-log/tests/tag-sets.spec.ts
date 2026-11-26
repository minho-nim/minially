import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';

test('해시태그 묶음 검사: 이름 20자, 태그는 # 빼고 겹침 없이 30개까지', async () => {
  const { readTagSet } = await import('../functions/_tagSets');
  const { mergeTags } = await import('../src/TagSets');
  expect(readTagSet({ name: '  성수   카페 ', tags: ['#성수', '성수', '카페 투어'] })).toEqual({ name: '성수 카페', tags: ['성수', '카페투어'] });
  for (const bad of [null, { name: '', tags: ['a'] }, { name: '가'.repeat(21), tags: ['a'] }, { name: '이름', tags: [] }, { name: '이름', tags: 'a' }])
    expect(typeof readTagSet(bad as Record<string, unknown> | null)).toBe('string');
  expect(mergeTags(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  expect(mergeTags(Array.from({ length: 29 }, (_, i) => `t${i}`), ['x', 'y'])).toHaveLength(30);
});

test('해시태그 묶음: 지금 태그를 저장하고, 다른 원고에서 눌러 넣고, 돌아보기 메모가 원고 화면에 보인다', async ({ page }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel('해시태그').fill('#성수카페 #디저트');
  await page.getByRole('button', { name: '지금 태그를 묶음으로 저장' }).click();
  await page.getByLabel('묶음 이름').fill('성수 카페');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: "'성수 카페' 묶음으로 저장했어요" })).toBeVisible();

  // 다른 사람은 내 묶음을 못 본다
  const other = await page.context().browser()!.newPage();
  await login(other, CODE_D);
  expect(await other.evaluate(async () => (await (await fetch('/api/tagsets')).json()).sets.length)).toBe(0);
  const id = await page.evaluate(async () => (await (await fetch('/api/tagsets')).json()).sets[0].id as string);
  expect(await other.evaluate(async i => (await fetch(`/api/tagsets/${i}`, { method: 'DELETE' })).status, id)).toBe(404);
  await other.close();

  // 새 원고에서 묶음을 누르면 태그가 더해진다(겹치는 건 한 번만)
  await page.getByRole('button', { name: '새 원고' }).click();
  await expect(page.getByLabel('해시태그')).toHaveValue(''); // 새 원고 화면이 열린 뒤에 적는다
  await page.getByLabel('해시태그').fill('#디저트 #연남');
  await page.getByRole('button', { name: "'성수 카페' 묶음 태그 2개 넣기" }).click();
  await expect(page.getByLabel('해시태그')).toHaveValue('#디저트 #연남 #성수카페');
  await expect(page.getByText('저장됨')).toBeVisible();

  // 잘못된 묶음은 서버가 거절
  expect(await page.evaluate(async () => (await fetch('/api/tagsets', { method: 'POST', body: JSON.stringify({ name: '', tags: ['a'] }) })).status)).toBe(400);

  // 지난 글에서 배운 점: 돌아보기 메모가 원고 화면에 보인다
  const version = await page.evaluate(async () => (await (await fetch('/api/backup')).json()).version);
  const at = Date.now() - 8 * 86400000, pid = 'dddddddd-0000-4000-8000-000000000001';
  await page.evaluate(async ([v, i, t]) => {
    await fetch('/api/backup', { method: 'POST', body: JSON.stringify({ app: 'mini-log', version: v, campaigns: [], styles: [], blogs: [], posts: [], watch: [], proposal: null,
      drafts: [{ id: i, title: '지난주 글', body: '', hashtags: [], experience: '', status: 'published', published_url: '', published_at: t, style_id: 'mine', planned_on: null, created_at: t, updated_at: t }] }) });
    await fetch('/api/reviews', { method: 'POST', body: JSON.stringify({ draft_id: i, verdict: 'low', note: '제목에 지역 이름을 넣자' }) });
  }, [version, pid, at] as const);
  await page.getByRole('button', { name: '새 원고' }).click();
  await expect(page.getByRole('complementary', { name: '지난 글에서 배운 점' })).toContainText('제목에 지역 이름을 넣자');

  await page.evaluate(async () => {
    for (const s of (await (await fetch('/api/tagsets')).json()).sets) await fetch(`/api/tagsets/${s.id}`, { method: 'DELETE' });
    for (const d of (await (await fetch('/api/drafts')).json()).drafts) await fetch(`/api/drafts/${d.id}`, { method: 'DELETE' });
  });
});
