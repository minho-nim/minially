import { expect, test } from '@playwright/test';
import type { Post } from '../functions/_blog';
import { CODE_D } from '../playwright.config';
import { login } from './helpers';

// 인기 SNS·블로그 관리 도구(Buffer·Later·Planoly·Canva·Metricool)에서 가져온 기능 중 규칙 부분

test('AI 요약 대비 점검: 첫 40자 핵심어·긴 문장·기준일·정리 줄·출처, 짧은 글은 보지 않는다', async () => {
  const { briefingCheck } = await import('../src/DraftCheck');
  expect(briefingCheck({ body: '짧은 글이에요.', postType: 'food' }, '소금빵')).toEqual([]);

  const longSentence = '이 가게는 골목 안쪽에 있어서 처음 가는 사람은 지도를 보고도 한참을 헤맬 수 있는데 저도 두 바퀴를 돌았어요.';
  const bad = briefingCheck({ body: `오늘은 날씨가 좋아서 산책을 나갔다가 우연히 들른 곳이에요.\n${longSentence.repeat(1)}\n${longSentence}\n${longSentence}\n${longSentence}\n소금빵 3,500원이고 맛있어요. ${'정말 맛있어요. '.repeat(100)}`, postType: 'food' }, '소금빵');
  const failed = Object.fromEntries(bad.filter(i => !i.ok).map(i => [i.label, i.hint]));
  expect(Object.keys(failed)).toEqual(["첫 40자에 핵심어 '소금빵'", '긴 문장(60자 넘음) 3개 이하', '가격·영업시간에 기준일', "정리 줄 3개 이상('항목: 값'·목록)"]);
  expect(failed['긴 문장(60자 넘음) 3개 이하']).toContain('4개');

  const good = briefingCheck({ body: `성수 소금빵 맛집, 버터 향이 진하고 웨이팅은 10분이었어요.\n위치: 성수역 3번 출구 5분\n가격: 소금빵 3,500원(2026년 11월 기준)\n영업시간: 8시~20시\n${'겉은 바삭하고 속은 촉촉해요. '.repeat(70)}`, postType: 'food' }, '소금빵');
  expect(good.map(i => i.label)).toContain("정리 줄 3개 이상('항목: 값'·목록)");
  expect(good.every(i => i.ok)).toBe(true);
  expect(briefingCheck({ body: `연말정산 간소화 자료는 1월 15일부터 볼 수 있어요. ${'신청 방법을 순서대로 알려 드릴게요. '.repeat(20)}`, postType: 'info' }, '연말정산').find(i => i.label === '정보 글 출처 표시')?.ok).toBe(false);
});

const post = (published_on: string, views: number | null): Post => ({
  post_key: published_on + views, blog_id: 'me', url: 'https://blog.naver.com/me/' + published_on, title: '글', published_on, summary: '', tags: [],
  views, likes: null, comments: null, stats_on: null, draft_id: null,
});

test('올리기 좋은 요일: 조회수 있는 글 6편 이상, 2편 이상 올린 요일끼리 비교', async () => {
  const { weekdayStats } = await import('../functions/_demand');
  const five = [post('2026-11-23', 100), post('2026-11-16', 300), post('2026-11-20', 500), post('2026-11-13', 700), post('2026-11-22', 1000), post('2026-11-25', null)];
  expect(weekdayStats(five).best).toBeNull(); // 조회수 있는 글이 5편뿐
  const six = weekdayStats([...five, post('2026-11-24', 50)]);
  expect(six.best).toMatchObject({ label: '금', posts: 2, avg: 600 }); // 일요일(1편 1000)은 비교에서 뺀다
  expect(six.days.find(d => d.label === '월')).toMatchObject({ posts: 2, avg: 200 });
  expect(six.days.find(d => d.label === '수')).toMatchObject({ posts: 0, avg: 0 }); // 조회수 없는 글은 세지 않는다
});

test('게시 시간표: 요일 검사와 빈 게시일 고르기(8주 안)', async () => {
  const { readDays, freeSlots } = await import('../functions/_plan');
  expect(readDays([5, 1, 3])).toEqual([1, 3, 5]);
  for (const bad of [[], [1, 1], [7], ['1'], 'mon', [0, 1, 2, 3, 4, 5, 6, 0]]) expect(readDays(bad)).toBeNull();
  // 2026-11-26은 목요일. 금요일(11/27)은 이미 원고가 있다
  expect(freeSlots('2026-11-26', [1, 3, 5], new Set(['2026-11-27']), 3)).toEqual(['2026-11-30', '2026-12-02', '2026-12-04']);
  const sundays = freeSlots('2026-11-26', [0], new Set(), 10);
  expect(sundays.filter(Boolean)).toHaveLength(8); // 8주 안 일요일 8번
  expect(sundays.slice(8)).toEqual([null, null]);
});

test('한 달 계획: 게시 요일을 고르고 수요 예측 글감을 골라 빈 게시일에 원고를 만든다', async ({ page, request }) => {
  for (const r of [await request.get('/api/plan'), await request.put('/api/plan', { data: { days: [1] } }), await request.post('/api/plan', { data: { items: [] } })]) expect(r.status()).toBe(401);
  await login(page, CODE_D);
  const setup = await page.evaluate(async () => {
    const s = [] as number[];
    s.push((await fetch('/api/blog', { method: 'POST', body: JSON.stringify({ blog_id: 'lastyear' }) })).status);
    s.push((await fetch('/api/blog/sync', { method: 'POST' })).status);
    s.push((await fetch('/api/blog/posts/225000000001', { method: 'PUT', body: JSON.stringify({ views: 500 }) })).status);
    s.push((await fetch('/api/blog/posts/225000000002', { method: 'PUT', body: JSON.stringify({ views: 100 }) })).status);
    // 잘못된 요청은 400
    s.push((await fetch('/api/plan', { method: 'PUT', body: JSON.stringify({ days: [] }) })).status);
    s.push((await fetch('/api/plan', { method: 'PUT', body: JSON.stringify({ days: [9] }) })).status);
    s.push((await fetch('/api/plan', { method: 'POST', body: JSON.stringify({ items: [] }) })).status);
    s.push((await fetch('/api/plan', { method: 'POST', body: JSON.stringify({ items: [{ title: '' }] }) })).status);
    return s;
  });
  expect(setup).toEqual([200, 200, 200, 200, 400, 400, 400, 400]);

  await page.getByRole('button', { name: '글감', exact: true }).click();
  const plan = page.locator('section').filter({ has: page.getByRole('heading', { name: /한 달 계획 한 번에 짜기/ }) });
  for (const day of ['월', '수', '금']) {
    const btn = plan.getByRole('group', { name: '게시 요일' }).getByRole('button', { name: day, exact: true });
    if (await btn.getAttribute('aria-pressed') !== 'true') await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
  }
  await expect.poll(async () => (await page.evaluate(async () => (await (await fetch('/api/plan')).json()).days)).filter((d: number) => [1, 3, 5].includes(d)).length).toBe(3);
  await plan.getByLabel(/작년 겨울 붕어빵 지도/).check();
  await plan.getByRole('button', { name: '고른 1개를 게시일에 나눠 원고 만들기' }).click();
  await expect(page.getByRole('status').filter({ hasText: '원고 1개를 만들었어요' })).toBeVisible();
  const draft = await page.evaluate(async () => (await (await fetch('/api/drafts')).json()).drafts.find((x: { title: string }) => x.title === '작년 겨울 붕어빵 지도'));
  const days = await page.evaluate(async () => (await (await fetch('/api/plan')).json()).days as number[]);
  expect(days).toContain(new Date(`${draft.planned_on}T00:00:00Z`).getUTCDay()); // 고른 게시 요일 중 하나
  expect(draft.hashtags).toEqual(['붕어빵', '겨울간식']);
  await page.evaluate(async id => {
    await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
    await fetch('/api/blog?blog_id=lastyear', { method: 'DELETE' });
  }, draft.id);
});

test('인스타 캡션 점검과 카드뉴스 7장 글 뽑기', async () => {
  const { instaCheck, cardSlides } = await import('../src/publishKit');
  const good = instaCheck('성수 소금빵 3곳 비교\n\n버터 향이 진해요.\n\n#성수 #소금빵 #빵집');
  expect(good.items.every(i => i.ok)).toBe(true);
  const bad = instaCheck(`${'아주 긴 첫 줄이라서 피드에서 눈에 잘 안 띄는 문장이에요 정말로요 이렇게 계속 길어지면 잘려요'}\n#a #b #c #d #e #f #g`);
  expect(bad.items.filter(i => !i.ok).map(i => i.label)).toEqual(['첫 줄 40자 안(피드에서 눈에 띄게)', '해시태그 3~5개']);
  expect(instaCheck('가'.repeat(300)).preview).toHaveLength(125);
  const slides = cardSlides('성수 소금빵 맛집 비교', '[사진 1]\n■ 위치\n성수역 3번 출구에서 5분이에요. 골목 안쪽이에요.\n버터 향이 정말 진해요. 겉은 바삭해요.\n가격은 3,500원이에요.');
  expect(slides).toHaveLength(7);
  expect(slides[0]).toBe('성수 소금빵 맛집 비교');
  expect(slides[1]).toBe('위치\n성수역 3번 출구에서 5분이에요.');
  expect(slides[2]).toBe('버터 향이 정말 진해요.');
  expect(slides[4]).toBe(''); // 문단이 모자라면 빈 장(사람이 채움)
  expect(slides[6]).toContain('블로그');
});

test('발행 칸: 인스타 캡션 점검(피드에 보이는 부분)과 카드뉴스 7장 받기', async ({ page }) => {
  await login(page, CODE_D);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel('제목').fill('성수 소금빵 맛집 비교');
  await page.getByLabel('본문').fill('■ 위치\n성수역 3번 출구에서 5분이에요.\n버터 향이 정말 진해요.\n가격은 3,500원이에요.');
  await page.getByRole('button', { name: '인스타 게시물 글 만들기' }).click();
  const check = page.getByLabel('인스타 캡션 점검');
  await expect(check).toContainText('피드에 보이는 부분');
  await expect(check).toContainText('해시태그 3~5개');
  await page.getByRole('button', { name: '카드뉴스 7장 만들기' }).click();
  await expect(page.locator('.card-canvas')).toHaveCount(7);
  await expect(page.getByLabel('카드 2 글')).toHaveValue('위치\n성수역 3번 출구에서 5분이에요.');
  await page.getByLabel('카드 7 글').fill('저장해 두세요');
  await expect(page.getByRole('img', { name: '카드 7: 저장해 두세요' })).toBeVisible();
  const files: string[] = [];
  page.on('download', d => files.push(d.suggestedFilename()));
  await page.getByRole('button', { name: '카드 7장 받기' }).click();
  await expect.poll(() => files.length).toBe(7);
  expect(files[0]).toMatch(/^minilog_card_\d{8}_01\.jpg$/);
  // 다른 시험에 영향이 없게 원고를 지운다
  await page.evaluate(async () => { const { drafts } = await (await fetch('/api/drafts')).json(); for (const d of drafts) if (d.title === '성수 소금빵 맛집 비교') await fetch(`/api/drafts/${d.id}`, { method: 'DELETE' }); });
});
