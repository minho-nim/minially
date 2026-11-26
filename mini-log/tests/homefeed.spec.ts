import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { STRUCTURES } from '../functions/_postTypes';
import { login } from './helpers';

test('홈피드형 규칙: 지어내기 금지·빈 곳은 [작성자 확인 필요]·소제목 3개·마무리 질문이 들어 있다', () => {
  const g = STRUCTURES.homefeed.guide;
  for (const must of ['[글 구조: 홈피드형]', '정확히 3개', '[작성자 확인 필요]', '새로 만들지 않는다', '질문 하나']) expect(g).toContain(must);
  expect(STRUCTURES.basic.guide).toBe('');
});

test('글 구조: 자세히 설정에서 홈피드형을 고르면 AI 초안에 반영되고, 기기에 기억된다', async ({ page }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel(/직접 겪은 내용/).fill('토요일에 성수 카페에 갔어요. 소금빵이 따뜻했고 줄이 길었어요.');
  // 접혀 있을 땐 요약만 보이고, 펼치면 고를 수 있다
  await expect(page.getByText(/구조: 기본 · 문체/)).toBeVisible();
  await page.getByRole('button', { name: /자세히 설정/ }).click();
  await page.getByLabel('글 구조').selectOption('homefeed');
  await expect(page.getByText('경험이 모자란 곳은 지어내지 않고')).toBeVisible();
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByLabel('본문')).toHaveValue(/\(글 구조: 홈피드형\)/);
  await expect(page.getByLabel('본문')).toHaveValue(/\[작성자 확인 필요\]/);
  await expect(page.getByText("'[작성자 확인 필요]' 모두 고치기")).toBeVisible(); // 원고 점검이 채울 곳을 알려 준다
  await page.reload();
  await expect(page.getByText(/구조: 홈피드형 · 문체/)).toBeVisible();
  // 서버: 모르는 구조 값은 기본으로
  const id = await page.evaluate(() => location.hash.split('/')[1]);
  const body = await page.evaluate(async id => (await (await fetch(`/api/drafts/${id}/generate`, { method: 'POST', body: JSON.stringify({ structure: 'clickbait' }) })).json()).draft.body as string, id);
  expect(body).not.toContain('홈피드형');
  await page.evaluate(async id => { await fetch(`/api/drafts/${id}`, { method: 'DELETE' }); }, id);
});
