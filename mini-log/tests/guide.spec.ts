import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login } from './helpers';
import { checkDraft } from '../src/DraftCheck';

test('원고 점검 규칙: 가이드 키워드·해시태그·사진·글자 수를 본다', () => {
  const guide = { keywords: ['성수 카페'], hashtags: ['성수카페'], min_photos: 3, min_chars: 10, links: [], visit_on: null, notes: '' };
  const bad = checkDraft({ title: '짧은 제목', body: '본문', hashtags: [], photos: 1 }, guide);
  expect(bad.filter(i => !i.ok).map(i => i.label)).toEqual([
    "키워드 '성수 카페'", '해시태그 #성수카페', '사진 3장 이상', '10자 이상(공백 빼고)', '제목에 첫 키워드', '제목 길이 15~40자', '해시태그 3개 이상',
  ]);
  const good = checkDraft({ title: '성수카페 소금빵 맛집 다녀온 솔직 후기', body: '[사진 1] 성수 카페에 다녀왔어요 정말 좋았어요', hashtags: ['성수카페', 'a', 'b'], photos: 3 }, guide);
  expect(good.every(i => i.ok)).toBe(true);
  // 가이드가 없으면 기본 점검만
  expect(checkDraft({ title: '', body: '', hashtags: [], photos: 0 }, null).map(i => i.label)).toEqual(['제목 길이 15~40자', '본문 1,000자 이상(공백 빼고)', '사진 5장 이상', '해시태그 3개 이상']);
});

test('가이드로 채우기: 붙여 넣은 글로 칸을 채우고, 연결한 원고에서 점검한다', async ({ page }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel('제목').fill('성수 카페 다녀온 이야기');
  await page.getByLabel('본문').fill('소금빵이 맛있었어요.');
  await expect(page.getByText('저장됨')).toBeVisible();
  const draftHash = await page.evaluate(() => location.hash);
  // 가이드 연결 전: 기본 점검
  const check = page.locator('section').filter({ has: page.getByRole('heading', { name: '원고 점검' }) });
  await expect(check).toContainText('기본 점검');

  await page.goto('/');
  await page.getByRole('button', { name: '협찬', exact: true }).click();
  await page.getByRole('button', { name: '새 협찬' }).click();
  await page.getByRole('button', { name: '✨ 가이드로 채우기' }).click();
  // 내부 주소는 거절 → 글 붙여넣기로 돌아감
  await page.getByRole('tab', { name: '링크' }).click();
  await page.getByLabel('가이드 주소').fill('https://localhost/guide');
  await page.getByRole('button', { name: '정리하기' }).click();
  await expect(page.getByRole('alert')).toContainText('https://');
  await expect(page.getByLabel('가이드 글')).toBeVisible();

  await page.getByLabel('업체').fill('내가적은집');
  await page.getByLabel('가이드 글').fill('업체명: 성수빵집\n키워드 성수 카페, 소금빵. 사진 15장 이상, 1500자 이상');
  await page.getByRole('button', { name: '정리하기' }).click();
  await expect(page.getByLabel('업체')).toHaveValue('내가적은집'); // 이미 적은 칸은 그대로
  await expect(page.getByLabel('캠페인 이름(선택)')).toHaveValue('성수빵집 겨울 신메뉴 체험단');
  await expect(page.getByLabel('금액(원)')).toHaveValue('30000');
  await expect(page.getByLabel('마감일(선택)')).toHaveValue('2026-12-10');
  const chips = page.getByLabel('가이드 지킬 것');
  await expect(chips).toContainText('🔑 성수 카페');
  await expect(chips).toContainText('📷 사진 15장 이상');
  await expect(chips).toContainText('공정위 문구 필수');
  await expect(chips).toContainText('🔗 링크 1개'); // http 주소는 빠짐
  await page.getByLabel('연결 원고(선택)').selectOption({ label: '성수 카페 다녀온 이야기' });
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.locator('.campaign').filter({ hasText: '내가적은집' })).toBeVisible();

  // 다시 열어도 가이드가 남아 있다
  await page.locator('.campaign').filter({ hasText: '내가적은집' }).click();
  await expect(page.getByLabel('가이드 지킬 것')).toContainText('#성수카페');

  await page.goto(`/${draftHash}`);
  await expect(check).toContainText('내가적은집 가이드 기준');
  await expect(check).toContainText('사진 15장 이상');
  await expect(check).not.toContainText("키워드 '소금빵'"); // 지킨 건 숨김
  await check.getByRole('button', { name: '전체 보기' }).click();
  await expect(check).toContainText("키워드 '소금빵'");

  await page.evaluate(async () => {
    for (const c of (await (await fetch('/api/campaigns')).json()).campaigns) await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' });
    for (const d of (await (await fetch('/api/drafts')).json()).drafts) await fetch(`/api/drafts/${d.id}`, { method: 'DELETE' });
  });
});

test('가이드로 채우기: 캡처 사진으로도 채운다', async ({ page }) => {
  const { pngBytes } = await import('./helpers');
  await login(page, CODE_C);
  await page.getByRole('button', { name: '협찬', exact: true }).click();
  await page.getByRole('button', { name: '새 협찬' }).click();
  await page.getByRole('button', { name: '✨ 가이드로 채우기' }).click();
  await page.getByRole('tab', { name: '캡처' }).click();
  await page.getByLabel('가이드 캡처').setInputFiles({ name: 'g.png', mimeType: 'image/png', buffer: pngBytes(60, 40, [240, 240, 240]) });
  await page.getByRole('button', { name: '정리하기' }).click();
  await expect(page.getByLabel('업체')).toHaveValue('캡처카페');
  await page.getByRole('button', { name: '취소' }).click();
});
