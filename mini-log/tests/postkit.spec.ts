import { expect, test } from '@playwright/test';
import { CODE_C } from '../playwright.config';
import { login, pngBytes } from './helpers';
import { fullText, instagramText, pasteBody, photoFileName } from '../src/publishKit';
import { eulReul, splitBody } from '../src/PostPreview';

test('올리기 글·사진 이름 만들기', () => {
  expect(pasteBody('첫 문단\n[사진 1]\n둘째 [사진2] 끝')).toBe('첫 문단\n📷 사진 1\n둘째 📷 사진 2 끝');
  expect(fullText(' 제목 ', '본문 [사진 1]', ['카페', '빵'])).toBe('제목\n\n본문 📷 사진 1\n\n#카페 #빵');
  expect(fullText('', '본문', [])).toBe('본문');
  expect([1, 2, 3, 10].map(n => `사진 ${n}${eulReul(n)}`)).toEqual(['사진 1을', '사진 2를', '사진 3을', '사진 10을']);
  expect(splitBody('첫 문단\n\n[사진 1]\n둘째 문단\n[사진 2][사진 3]\n끝')).toEqual([
    { kind: 'text', text: '첫 문단' }, { kind: 'photo', n: 1 }, { kind: 'text', text: '둘째 문단' }, { kind: 'photo', n: 2 }, { kind: 'photo', n: 3 }, { kind: 'text', text: '끝' },
  ]);
  expect(photoFileName(0, Date.parse('2026-11-23T16:00:00Z'))).toBe('minilog_20261124_01.jpg'); // 한국 시간 기준 날짜
  expect(photoFileName(11, Date.parse('2026-11-23T10:00:00Z'))).toBe('minilog_20261123_12.jpg');
});

test('인스타 글(규칙): 사진 표시 빼기·해시태그 30개·2,200자', () => {
  expect(instagramText('제목', '첫 문단\n[사진 1]\n\n\n\n둘째', ['#카페', '카페', '빵 집'])).toBe('제목\n\n첫 문단\n\n둘째\n\n#카페 #빵집');
  const many = Array.from({ length: 40 }, (_, i) => `태그${i}`);
  expect((instagramText('t', 'b', many).match(/#/g) ?? []).length).toBe(30);
  const long = instagramText('t', 'ㄱ'.repeat(5000), ['a']);
  expect(long.length).toBeLessThanOrEqual(2200);
  expect(long.endsWith('#a')).toBe(true);
  expect(instagramText('t', 'b', ['x'], 'AI 글')).toBe('AI 글\n\n#x');
});

test('올리기 보조: 한 번에·따로 복사, 사진 번호 붙여 받기, 주소 넣어 게시 완료', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.locator('input[type=file]').setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: pngBytes(40, 30, [200, 90, 80]) },
    { name: 'b.png', mimeType: 'image/png', buffer: pngBytes(30, 40, [90, 200, 80]) },
  ]);
  await expect(page.getByRole('img', { name: /^사진 2:/ })).toBeVisible();
  await page.getByLabel('제목').fill('올리기 시험 원고');
  await page.getByLabel('본문').fill('첫 문단\n[사진 1]\n두 번째 문단\n[사진 2]');
  await page.getByLabel('해시태그').fill('#카페 #시험');
  await expect(page.getByText('저장됨')).toBeVisible();
  const kit = page.locator('.post-kit');
  const clip = () => page.evaluate(() => navigator.clipboard.readText());

  await kit.getByRole('button', { name: '한 번에 복사' }).click();
  await expect(kit.getByRole('button', { name: '복사됨 ✓' })).toBeVisible();
  expect(await clip()).toBe('올리기 시험 원고\n\n첫 문단\n📷 사진 1\n두 번째 문단\n📷 사진 2\n\n#카페 #시험');
  await expect(page.getByRole('status').filter({ hasText: '사진 n 자리에' })).toBeVisible();

  // 미리보기: 블로그처럼 보이고, 눌러서 하나씩 복사(제목 → 문단 1 → 사진 1 → 문단 2 → 사진 2 → 해시태그)
  const preview = page.getByLabel('올릴 글 미리보기');
  const blocks = preview.locator('.pv-block');
  await expect(blocks).toHaveCount(6);
  await expect(preview.getByRole('img', { name: '사진 2' })).toBeVisible();
  await preview.getByRole('button', { name: '제목 복사' }).click();
  expect(await clip()).toBe('올리기 시험 원고');
  await expect(preview.getByRole('button', { name: '제목 복사' })).toHaveClass(/copied/);
  await preview.getByRole('button', { name: '문단 1 복사' }).click();
  expect(await clip()).toBe('첫 문단');
  await preview.getByRole('button', { name: '문단 2 복사' }).click();
  expect(await clip()).toBe('두 번째 문단');
  await preview.getByRole('button', { name: '해시태그 복사' }).click();
  expect(await clip()).toBe('#카페 #시험');
  // 사진은 이미지(PNG)로 복사돼 글쓰기 화면에 바로 붙여 넣을 수 있다
  await preview.getByRole('button', { name: '사진 2 복사' }).click();
  await expect(page.getByText('사진 2를 복사했어요')).toBeVisible();
  const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap(i => i.types));
  expect(types).toContain('image/png');

  // 사진: 글 순서대로 번호 붙은 파일 2개
  const names: string[] = [];
  page.on('download', d => { names.push(d.suggestedFilename()); });
  await kit.getByRole('button', { name: '번호 붙여 받기(2장)' }).click();
  await expect(page.getByText('사진 2장을 받았어요')).toBeVisible();
  await expect.poll(() => names.length).toBe(2);
  expect(names).toEqual([photoFileName(0), photoFileName(1)]);
  await expect(kit.getByRole('link', { name: /네이버 블로그 글쓰기/ })).toHaveAttribute('href', 'https://blog.naver.com/GoBlogWrite.naver');

  // 인스타 게시물 글: 규칙 글 → AI 글(자연스러운 한국어 규칙) → 고치기 → 복사
  await kit.getByRole('button', { name: '인스타 게시물 글 만들기' }).click();
  const insta = page.getByLabel('인스타 게시물 글');
  await expect(insta).toHaveValue('올리기 시험 원고\n\n첫 문단\n\n두 번째 문단\n\n#카페 #시험');
  await kit.getByRole('button', { name: 'AI로 인스타 글 쓰기' }).click();
  await expect(insta).toHaveValue('오늘의 기록 한 줄\n\n가짜 AI 인스타 글이에요. (규칙 적용)\n\n#카페 #시험태그');
  await insta.fill('내가 고친 인스타 글 #카페');
  await kit.getByRole('button', { name: '인스타 글 복사' }).click();
  expect(await clip()).toBe('내가 고친 인스타 글 #카페');
  await expect(kit).toContainText('해시태그 1/30개');

  // 스레드·X: 규칙 글 → AI로 짧게(서버가 태그·주소·[사진] 지움) → 글이 채워진 작성 화면 주소
  await kit.getByRole('button', { name: '스레드·X 글 만들기' }).click();
  const threads = page.getByLabel('스레드', { exact: true });
  await expect(threads).toHaveValue('올리기 시험 원고\n\n첫 문단\n두 번째 문단\n\n#카페');
  await kit.getByRole('button', { name: 'AI로 짧게 다듬기' }).click();
  await expect(threads).toHaveValue('빵 좋아하면 꼭 가 보세요\n소금빵이 바삭해요\n\n#카페');
  await expect(page.getByLabel('X', { exact: true })).toHaveValue('동네 빵집 소금빵 바삭\n#카페');
  const open = kit.getByRole('link', { name: 'X에서 열기 ↗' });
  expect(await open.getAttribute('href')).toBe('https://x.com/intent/post?text=' + encodeURIComponent('동네 빵집 소금빵 바삭\n#카페'));
  await expect(kit.getByRole('link', { name: '스레드에서 열기 ↗' })).toHaveAttribute('href', /^https:\/\/www\.threads\.net\/intent\/post\?text=/);
  await kit.getByRole('button', { name: '스레드 글 복사' }).click();
  expect(await clip()).toBe('빵 좋아하면 꼭 가 보세요\n소금빵이 바삭해요\n\n#카페');

  // 직접 올린 곳 체크: 저장되고 다시 열어도 그대로(미니허브 숫자에 들어감)
  const channels = () => page.evaluate(async () => Object.keys((await (await fetch(`/api/drafts/${location.hash.split('/').pop()}/shares`)).json()).channels));
  await kit.getByLabel('스레드에 올렸어요').check();
  await expect.poll(channels).toEqual(['threads']);
  await kit.getByLabel('스레드에 올렸어요').uncheck();
  await expect.poll(channels).toEqual([]);
  await kit.getByLabel('X에 올렸어요').check();

  // 올린 뒤 주소 → 게시 완료
  await page.getByLabel('게시한 글 주소').fill('https://blog.naver.com/myblog/223999999999');
  await page.getByRole('button', { name: '게시 완료' }).click();
  await expect(page.getByText(/^게시 완료 ·/)).toBeVisible();
  await expect(page.locator('.post-kit')).toHaveCount(0);

  // 다른 시험(빈 목록 확인)에 영향이 없게 지운다
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: '삭제' }).click();
});
