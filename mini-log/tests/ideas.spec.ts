import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login } from './helpers';

test('다가오는 시기·참고 블로그로 글감을 추천받고, 검색 포함도 되고, 글감으로 원고를 만든다', async ({ page }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '글감', exact: true }).click();
  await expect(page.getByRole('heading', { name: '글감', exact: true })).toBeVisible();
  // 다가오는 시기(앱 안 달력, 45일 안)
  await expect(page.locator('.trend-chips li').first()).toBeVisible(); // 불러온 뒤에 확인

  // 참고 블로그: 티스토리 제목만 가져온다. 없는 블로그는 오류
  await page.getByLabel('참고 블로그 주소').fill('mytravel.tistory.com');
  await page.getByRole('button', { name: '더하기' }).click();
  await expect(page.locator('.blog-links li', { hasText: 'mytravel' })).toContainText('제주 여행 3박 4일 코스');
  await page.getByLabel('참고 블로그 주소').fill('nobody');
  await page.getByRole('button', { name: '더하기' }).click();
  await expect(page.getByRole('alert')).toContainText('nobody: 못 받았어요(404)');
  await page.getByRole('button', { name: 'nobody 참고 블로그 지우기' }).click();
  await expect(page.locator('.blog-links li')).toHaveCount(1);

  // 기본 추천(검색 없음): 시기·참고 블로그가 AI에게 전달된다
  await page.getByRole('button', { name: '글감 추천받기' }).click();
  await expect(page.locator('.idea')).toHaveCount(2);
  await expect(page.locator('.idea').first()).toContainText('시기 맞춤: 창가 자리 카페 3곳');
  await expect(page.locator('.idea').first().locator('.src')).toHaveText('시기'); // AI가 모르는 출처(trend)는 시기로
  await expect(page.locator('.idea').nth(1)).toContainText('참고 블로그 반영: 겨울 제주 코스');

  // 검색 포함: 설명 글 사이의 JSON도 읽는다
  await page.getByLabel('최신 검색 포함').check();
  await page.getByRole('button', { name: '다시 추천받기' }).click();
  await expect(page.locator('.idea')).toHaveCount(3);
  await expect(page.locator('.idea').nth(2)).toContainText('구글 검색');
  await expect(page.locator('#rec-title')).toContainText('검색 포함');

  // 다시 열어도 마지막 추천이 남아 있다
  await page.reload();
  await page.getByRole('button', { name: '글감', exact: true }).click();
  await expect(page.locator('.idea')).toHaveCount(3);

  // 글감으로 원고 만들기(날짜 지정): 제목·해시태그가 채워지고 경험 칸은 비어 있다
  await page.getByLabel('게시 예정일').first().fill('2026-12-24');
  await page.locator('.idea').first().getByRole('button', { name: '이걸로 원고 만들기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('시기 맞춤: 창가 자리 카페 3곳');
  const draft = await page.evaluate(async () => (await (await fetch('/api/drafts')).json()).drafts.find((d: { title: string }) => d.title === '시기 맞춤: 창가 자리 카페 3곳'));
  expect(draft.planned_on).toBe('2026-12-24');
  expect(draft.hashtags).toEqual(['카페', '데이트']);
  expect(draft.experience).toBe('');
  // 다른 시험(빈 목록 확인)에 영향이 없게 지운다
  await page.evaluate(async id => { await fetch(`/api/drafts/${id}`, { method: 'DELETE' }); }, draft.id);
});

test('글감 API는 로그인 없이 쓸 수 없다', async ({ request }) => {
  expect((await request.get('/api/ideas')).status()).toBe(401);
  expect((await request.post('/api/ideas', { data: {} })).status()).toBe(401);
  expect((await request.post('/api/ideas/watch', { data: { blog_id: 'x' } })).status()).toBe(401);
});

test('다가오는 시기: 45일 안, 해 넘김, 설·추석', async () => {
  const { upcomingSeasons } = await import('../functions/_ideas');
  const labels = (day: string) => upcomingSeasons(day).map(s => `${s.from} ${s.label}`);
  expect(labels('2026-11-23')).toContain('2026-12-01 크리스마스·연말 선물');
  expect(labels('2026-11-23').some(l => l.includes('발렌타인'))).toBe(false);
  expect(labels('2026-12-20')).toContain('2027-01-01 새해 계획·신년 다이어리');
  expect(labels('2027-01-25')).toContain('2027-01-23 설날 선물·연휴 나들이');
  expect(labels('2026-09-01')).toContain('2026-09-10 추석 선물·연휴 나들이');
  expect(upcomingSeasons('2026-11-23').length).toBeLessThanOrEqual(8);
});
