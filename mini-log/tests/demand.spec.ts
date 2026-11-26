import { expect, test } from '@playwright/test';
import { CODE_D } from '../playwright.config';
import { login } from './helpers';
import type { Post } from '../functions/_blog';

const post = (over: Partial<Post> & { title: string; published_on: string | null }): Post => ({
  post_key: over.title, blog_id: 'me', url: `https://blog.naver.com/me/${encodeURIComponent(over.title)}`, summary: '', tags: [],
  views: null, likes: null, comments: null, stats_on: null, draft_id: null, ...over,
});

test('수요 예측: 작년 이맘때 잘 된 글, 시기와 예전 글, 꾸준한 태그, 올릴 날 순서', async () => {
  const { forecastDemand, seasonWords } = await import('../functions/_demand');
  expect(seasonWords('크리스마스·연말 선물')).toEqual(['크리스마스', '연말']);
  expect(seasonWords('설날 선물·연휴 나들이')).toEqual(['설날']);

  const posts = [
    post({ title: '연말 홈파티 준비', published_on: '2025-12-10', views: 2200, tags: ['홈파티'] }), // 작년 이맘때, 보통 글 이상
    post({ title: '작년 이맘때 짧은 메모', published_on: '2025-12-01', views: 5 }), // 작년 이맘때지만 조회수가 낮음
    post({ title: '크리스마스 케이크 후기', published_on: '2024-12-20', views: 1500, tags: ['케이크'] }), // 크리스마스 시기 글
    post({ title: '소금빵 맛집 1', published_on: '2026-05-02', views: 4000, tags: ['소금빵'] }),
    post({ title: '소금빵 맛집 2', published_on: '2026-08-15', views: 3600, tags: ['소금빵'] }),
    post({ title: '카페 1', published_on: '2026-08-01', views: 2500, tags: ['카페'] }),
    post({ title: '카페 2', published_on: '2026-11-20', views: 3000, tags: ['카페'] }), // 30일 안에 쓴 태그는 빼기
    post({ title: '봄 메모', published_on: '2026-03-01', views: 10 }),
    post({ title: '봄 메모 2', published_on: '2026-03-02', views: 20 }),
    post({ title: '날짜 없는 글', published_on: null, views: 9999, tags: ['소금빵'] }),
    post({ title: '내일 글', published_on: '2026-11-27', views: 9999 }),
  ];
  const d = forecastDemand(posts, '2026-11-26');
  expect([d.from, d.to, d.posts_with_views, d.posts_last_year]).toEqual(['2026-11-26', '2026-12-24', 9, 2]);
  expect(d.items.map(i => [i.basis, i.topic, i.post_by])).toEqual([
    ['season', '크리스마스·연말 선물', '2026-11-26'],
    ['season', '연말 모임·송년회', '2026-11-26'],
    ['last_year', '연말 홈파티 준비', '2026-12-02'], // 작년 12/10 + 52주 - 1주
    ['season', '새해 계획·신년 다이어리', '2026-12-18'], // 1/1의 2주 전
    ['steady', '소금빵', null],
  ]);
  expect(d.items[0].reason).toBe('12/1~12/25 시기 · 예전 글 「크리스마스 케이크 후기」 조회 1,500회');
  expect(d.items[0].url).toContain('blog.naver.com');
  expect(d.items[1].reason).toContain('내 글은 아직 없어요'); // 작년 이맘때로 쓴 글은 다시 쓰지 않는다
  expect(d.items[2].reason).toBe('작년 12/10에 올린 글 · 조회 2,200회 · 올해 새 경험으로 다시 쓰기');
  expect(d.items[2].tags).toEqual(['홈파티']);
  expect(d.items[4].reason).toBe('글 2편 평균 조회 3,800회 · 마지막 글 103일 전');
  expect(d.items.some(i => i.topic === '김장·겨울 준비')).toBe(false); // 일주일 안에 끝나는 시기

  // 글이 없으면 시기만, 해가 바뀌어도 52주 전을 본다
  const empty = forecastDemand([], '2026-11-26');
  expect(empty.items.every(i => i.basis === 'season' && i.views === null)).toBe(true);
  const jan = forecastDemand([post({ title: '작년 신년 계획', published_on: '2026-01-08', views: 300 })], '2027-01-05');
  expect(jan.items.find(i => i.basis === 'last_year')).toMatchObject({ topic: '작년 신년 계획', post_by: '2027-01-05' });
});

test('글감 화면에서 작년 이맘때 내 글로 수요 예측을 보고, 올릴 날로 원고를 만든다(AI 키 없음)', async ({ page }) => {
  await login(page, CODE_D);
  // 사용자 D에 작년 글이 있는 블로그를 잠깐 연결하고 조회수를 넣는다
  const setup = await page.evaluate(async () => {
    const add = await fetch('/api/blog', { method: 'POST', body: JSON.stringify({ blog_id: 'lastyear' }) });
    const sync = await fetch('/api/blog/sync', { method: 'POST' });
    const a = await fetch('/api/blog/posts/225000000001', { method: 'PUT', body: JSON.stringify({ views: 500 }) });
    const b = await fetch('/api/blog/posts/225000000002', { method: 'PUT', body: JSON.stringify({ views: 100 }) });
    const ideas = await (await fetch('/api/ideas')).json();
    return { status: [add.status, sync.status, a.status, b.status], demand: ideas.demand };
  });
  expect(setup.status).toEqual([200, 200, 200, 200]);
  const item = setup.demand.items.find((i: { basis: string }) => i.basis === 'last_year');
  expect(item.topic).toBe('작년 겨울 붕어빵 지도');
  expect(setup.demand.items.some((i: { topic: string }) => i.topic === '작년 귤 따기 체험')).toBe(false); // 보통 글(300)보다 낮음

  await page.getByRole('button', { name: '글감', exact: true }).click();
  const row = page.locator('.demand', { hasText: '작년 겨울 붕어빵 지도' });
  await expect(row).toContainText('작년 이맘때');
  await expect(row).toContainText('조회 500회');
  await expect(row.getByRole('link', { name: '예전 글 보기' })).toHaveAttribute('href', 'https://blog.naver.com/lastyear/225000000001');
  await expect(row.getByLabel('올릴 날')).toHaveValue(item.post_by);
  await expect(page.locator('.idea')).toHaveCount(0); // AI 글감 목록과 섞이지 않는다

  await row.getByRole('button', { name: '이걸로 원고 만들기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('작년 겨울 붕어빵 지도');
  const draft = await page.evaluate(async () => (await (await fetch('/api/drafts')).json()).drafts.find((x: { title: string }) => x.title === '작년 겨울 붕어빵 지도'));
  expect(draft.planned_on).toBe(item.post_by);
  expect(draft.hashtags).toEqual(['붕어빵', '겨울간식']);
  // 다른 시험에 영향이 없게 원고와 블로그 연결(가져온 글도)을 지운다
  await page.evaluate(async id => {
    await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
    await fetch('/api/blog?blog_id=lastyear', { method: 'DELETE' });
  }, draft.id);
});
