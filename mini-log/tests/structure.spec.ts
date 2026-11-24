import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';
import { parseOutline } from '../src/Structure';

test('목록 붙여 넣기 해석: 앞에 공백이면 소분류', () => {
  let n = 0;
  const tree = parseOutline('맛집\n  성수\n  - 강남\n카페\n\n제품 리뷰', () => `id${n++}`);
  expect(tree.map(c => [c.name, c.parent_id])).toEqual([['맛집', null], ['성수', 'id0'], ['강남', 'id0'], ['카페', null], ['제품 리뷰', null]]);
});

test('블로그 구조: 카테고리 붙여 넣기 → 끌어다 배치·골라서 옮기기 → 태그 자동 배치 → 묶음과 빠진 링크 → 지우면 미분류', async ({ page, browser }) => {
  await login(page, CODE_C);
  // 블로그 글 가져오기(가짜 RSS: 동네 빵집 소금빵 후기·겨울 카페 투어 3곳·앰플 한 달 사용기, 태그 빵집·카페) + 원고 하나
  const draftId = await page.evaluate(async () => {
    const send = (url: string, method: string, body: unknown) => fetch(url, { method, body: JSON.stringify(body) }).then(r => r.json());
    await send('/api/blog', 'POST', { blog_id: 'myblog' });
    await send('/api/blog/sync', 'POST', { blog_id: 'myblog' });
    const d = (await send('/api/drafts', 'POST', {})).draft;
    await send(`/api/drafts/${d.id}`, 'PUT', { title: '성수 소금빵 2탄', body: '지난 글 https://blog.naver.com/myblog/223000000001 에 이어서' });
    return d.id as string;
  });
  await page.goto('/#structure');
  await expect(page.getByRole('heading', { name: '블로그 구조' })).toBeVisible();
  await page.getByRole('button', { name: '목록 붙여 넣기' }).click();
  await page.getByLabel(/카테고리 목록/).fill('빵집\n  성수\n카페\n제품 리뷰');
  await page.getByRole('button', { name: '더하기', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('카테고리 4개');
  const tree = page.getByRole('complementary', { name: '카테고리' });
  await expect(tree.locator('.st-name', { hasText: /^성수/ })).toBeVisible();

  // 태그가 카테고리 이름과 같은 글(빵집·카페) 자동 배치
  await page.getByRole('button', { name: /태그로 자동 배치\(2\)/ }).click();
  await expect(page.getByRole('status')).toContainText("옮겼어요");
  await tree.locator('.st-name', { hasText: /^빵집/ }).click();
  await expect(page.locator('.st-items')).toContainText('동네 빵집 소금빵 후기');

  // 미분류의 앰플 글을 끌어다 '제품 리뷰'에 놓기
  await tree.locator('.st-name', { hasText: '미분류' }).click();
  const amp = page.locator('.st-items li').filter({ hasText: '앰플 한 달 사용기' });
  await amp.dragTo(tree.locator('.st-node').filter({ hasText: '제품 리뷰' }));
  await expect(page.getByRole('status')).toContainText("'제품 리뷰'(으)로 옮겼어요");
  // 원고는 골라서 옮기기(휴대폰 방식)로 성수에
  await page.getByLabel('성수 소금빵 2탄 고르기').check();
  await page.getByLabel('고른 글 옮기기').selectOption({ label: '　› 성수' });
  await expect(page.getByRole('status')).toContainText("'성수'(으)로 옮겼어요");

  // 빵집(대분류)에는 성수(소분류) 글까지 모여 보인다 → 묶음 만들기(대표: 소금빵 후기)
  await tree.locator('.st-name', { hasText: /^빵집/ }).click();
  await expect(page.locator('.st-items li')).toHaveCount(2);
  await page.getByLabel('동네 빵집 소금빵 후기 고르기').check();
  await page.getByLabel('성수 소금빵 2탄 고르기').check();
  await page.getByRole('button', { name: '묶음 만들기' }).click();
  await page.getByLabel('묶음 이름').fill('소금빵');
  await page.getByRole('button', { name: '만들기', exact: true }).click();
  const bundle = page.getByLabel('묶음 소금빵');
  await expect(bundle).toContainText('대표');
  await expect(bundle).toContainText('✓ 묶음 글끼리 서로 링크했어요'); // 원고 본문에 대표 글 주소가 있음
  // 원고 본문에서 링크를 지우면 빠진 링크로
  await page.evaluate(async id => { await fetch(`/api/drafts/${id}`, { method: 'PUT', body: JSON.stringify({ body: '링크 없는 본문' }) }); }, draftId);
  await page.reload();
  await tree.locator('.st-name', { hasText: /^빵집/ }).click();
  await expect(page.getByLabel('묶음 소금빵')).toContainText('빠진 링크 1개');

  // 원고 편집에서도 카테고리가 보이고 바꿀 수 있다
  await page.goto(`/#draft/${draftId}`);
  await expect(page.locator('#cat-pick option:checked')).toHaveText('빵집 › 성수');
  await page.getByLabel('블로그 카테고리').selectOption({ label: '카페' });
  await expect(page.getByRole('status').filter({ hasText: '카테고리: 카페' })).toBeVisible();
  await page.getByLabel('블로그 카테고리').selectOption({ label: '빵집 › 성수' });
  await expect(page.getByRole('status').filter({ hasText: '카테고리: 빵집 › 성수' })).toBeVisible();
  await page.goto('/#structure');
  // 다른 사용자는 볼 수 없고 남의 카테고리 아이디로 배치 못 함
  const d = await (await browser.newContext()).newPage();
  await login(d, CODE_D);
  const other = await d.evaluate(async () => (await (await fetch('/api/structure')).json()));
  expect(other.categories).toEqual([]);
  const cId = await page.evaluate(async () => (await (await fetch('/api/structure')).json()).categories[0].id);
  expect(await d.evaluate(async id => (await fetch('/api/structure/place', { method: 'PUT', body: JSON.stringify({ items: ['draft:00000000-0000-0000-0000-000000000000'], category_id: id }) })).status, cId)).toBe(400);
  expect(await d.evaluate(async id => (await fetch('/api/structure/categories', { method: 'PUT', body: JSON.stringify({ categories: [{ id, name: '가로채기', parent_id: null }] }) })).status, cId)).toBe(400);
  // 백업: C의 구조를 D에 합치면 카테고리가 생긴다(아이디가 겹치는 C 카테고리는 D 것이 될 수 없어 건너뜀)
  const backup = await page.evaluate(async () => (await fetch('/api/backup')).json());
  expect(backup.structure.categories.map((c: { name: string }) => c.name)).toEqual(['빵집', '성수', '카페', '제품 리뷰']);
  expect(backup.structure.bundles[0].name).toBe('소금빵');
  const mergedRes = await d.evaluate(async b => (await fetch('/api/backup', { method: 'POST', body: JSON.stringify(b) })).json(), backup);
  expect(mergedRes.error).toBeUndefined();
  const merged = mergedRes.result.structure;
  expect(merged).toMatchObject({ added: 5, skipped: 0 }); // 카테고리 4개(새 아이디로)+묶음 1개
  const dCats = await d.evaluate(async () => (await (await fetch('/api/structure')).json()).categories as { id: string; name: string; parent_id: string | null }[]);
  expect(dCats.map(c => c.name)).toEqual(['빵집', '성수', '카페', '제품 리뷰']);
  expect(dCats.find(c => c.name === '성수')!.parent_id).toBe(dCats.find(c => c.name === '빵집')!.id); // 소분류 연결도 새 아이디로
  expect(dCats.some(c => backup.structure.categories.some((x: { id: string }) => x.id === c.id))).toBe(false);
  // 다시 합쳐도 같은 이름이 두 번 생기지 않는다
  const again = await d.evaluate(async b => (await (await fetch('/api/backup', { method: 'POST', body: JSON.stringify(b) })).json()).result.structure, backup);
  expect(again).toMatchObject({ added: 0, kept: 5 });
  // 3단은 거절
  expect(await page.evaluate(async () => {
    const a = crypto.randomUUID(), b = crypto.randomUUID(), c = crypto.randomUUID();
    return (await fetch('/api/structure/categories', { method: 'PUT', body: JSON.stringify({ categories: [{ id: a, name: 'a' }, { id: b, name: 'b', parent_id: a }, { id: c, name: 'c', parent_id: b }] }) })).status;
  })).toBe(400);

  // 글감 추천은 오래 글이 없는 카테고리(게시 글 없는 '빵집 › 성수')를 꼭 넣는다
  const ideas = await page.evaluate(async () => (await (await fetch('/api/ideas', { method: 'POST', body: JSON.stringify({}) })).json()).ideas as { topic: string }[]);
  expect(ideas.map(i => i.topic)).toContain('잠잠한 카테고리: 빵집 › 성수');
  // 빵집을 지우면 안의 글(성수 포함)은 미분류로
  page.once('dialog', dlg => dlg.accept());
  await tree.getByRole('button', { name: '빵집 지우기' }).click();
  await expect(tree.locator('.st-name', { hasText: /^성수/ })).toHaveCount(0);
  await tree.locator('.st-name', { hasText: '미분류' }).click();
  await expect(page.locator('.st-items:not(.plain)')).toContainText('동네 빵집 소금빵 후기');
  await page.screenshot({ path: 'test-results/structure.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 400, height: 900 });
  await page.screenshot({ path: 'test-results/structure-400.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await d.evaluate(async () => {
    const s = await (await fetch('/api/structure')).json();
    for (const b of s.bundles) await fetch(`/api/structure/bundles/${b.id}`, { method: 'DELETE' });
    await fetch('/api/structure/categories', { method: 'PUT', body: JSON.stringify({ categories: [] }) });
  });

  await page.evaluate(async () => {
    const s = await (await fetch('/api/structure')).json();
    for (const b of s.bundles) await fetch(`/api/structure/bundles/${b.id}`, { method: 'DELETE' });
    await fetch('/api/structure/categories', { method: 'PUT', body: JSON.stringify({ categories: [] }) });
    for (const dr of (await (await fetch('/api/drafts')).json()).drafts) await fetch(`/api/drafts/${dr.id}`, { method: 'DELETE' });
  });
});
