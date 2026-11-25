import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login } from './helpers';
import { readShare, searchUrl } from '../src/campaignFinder';

test('공유 주소 읽기: text 안의 https 주소도 꺼내고, https가 아니면 버린다', () => {
  expect(readShare('?title=%EC%84%B1%EC%88%98&text=%EB%B3%B4%EC%84%B8%EC%9A%94%20https%3A%2F%2Fex.com%2Fc%2F9')).toEqual({ url: 'https://ex.com/c/9', title: '성수' });
  expect(readShare('?url=https%3A%2F%2Fex.com%2Fa')).toEqual({ url: 'https://ex.com/a', title: '' });
  expect(readShare('?text=javascript%3Aalert(1)')).toBeNull();
  expect(readShare('?url=http%3A%2F%2Fex.com')).toBeNull();
  expect(readShare('')).toBeNull();
  expect(searchUrl({ region: '성수', topic: '맛집' })).toBe(`https://search.naver.com/search.naver?query=${encodeURIComponent('성수 맛집 체험단 모집')}`);
});

test('휴대폰 공유로 열면 관심 협찬으로 담고, 가이드로 채우면 신청 기한·공고 주소까지 채운다', async ({ page }) => {
  await login(page, CODE_C);
  await page.goto(`/?title=${encodeURIComponent('공유빵집 체험단')}&text=${encodeURIComponent('이거 봐 https://example.invalid/campaign/9')}`);
  await expect(page.getByRole('heading', { name: '협찬·수익' })).toBeVisible();
  await expect(page).toHaveURL(/#campaigns$/); // ?… 는 지움
  await expect(page.getByLabel('상태')).toHaveValue('interested');
  await expect(page.getByLabel('모집 공고 주소(선택)')).toHaveValue('https://example.invalid/campaign/9');
  await expect(page.getByLabel('캠페인 이름(선택)')).toHaveValue('공유빵집 체험단');
  await expect(page.getByLabel('가이드 주소')).toHaveValue('https://example.invalid/campaign/9'); // 링크 탭이 열려 있음
  // 읽을 수 없는 주소 → 글 붙여넣기로
  await page.getByRole('button', { name: '정리하기' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('가이드 글').fill('업체명: 공유빵집\n신청 마감 11월 28일');
  await page.getByRole('button', { name: '정리하기' }).click();
  await expect(page.getByLabel('업체')).toHaveValue('공유빵집');
  await expect(page.getByLabel('신청 기한(선택)')).toHaveValue('2026-11-28');
  await expect(page.getByLabel('모집 공고 주소(선택)')).toHaveValue('https://example.invalid/campaign/9'); // 공유한 주소 유지
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.locator('.campaigns li').filter({ hasText: '공유빵집' })).toContainText('관심');

  await page.evaluate(async () => { for (const c of (await (await fetch('/api/campaigns')).json()).campaigns) await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' }); });
});

test('체험단 찾기: 지역·분야를 기억하고 검색 화면을 새 창으로 연다', async ({ page }) => {
  await login(page, CODE_C);
  const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  expect(manifest.share_target).toEqual({ action: '/', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } });
  await page.getByRole('button', { name: '협찬', exact: true }).click();
  await page.getByRole('tab', { name: '관심·신청' }).click();
  await page.getByLabel('지역').fill('성수');
  await page.getByLabel('분야').fill('맛집');
  const naver = page.getByRole('link', { name: '네이버에서 찾기' });
  await expect(naver).toHaveAttribute('href', `https://search.naver.com/search.naver?query=${encodeURIComponent('성수 맛집 체험단 모집')}`);
  await expect(naver).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.getByRole('link', { name: '체험ZIP(통합 검색)' })).toHaveAttribute('target', '_blank');
  await page.reload();
  await page.getByRole('tab', { name: '관심·신청' }).click();
  await page.locator('.finder > summary').click();
  await expect(page.getByLabel('지역')).toHaveValue('성수');
});
