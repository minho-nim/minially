import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login, pngBytes } from './helpers';
import { factCheck, qualityCheck } from '../src/DraftCheck';
import { emptyOutline } from '../src/PhotoNotes';

const files = [
  { name: '빵.png', mimeType: 'image/png', buffer: pngBytes(40, 40, [230, 120, 90]) },
  { name: '커피.png', mimeType: 'image/png', buffer: pngBytes(40, 40, [90, 60, 40]) },
];

test('사실 확인 규칙: 경험·메모에 없는 가격·날짜·시간만 골라낸다', () => {
  const body = '소금빵은 3,500원이었고 아메리카노는 4500원. 12월 3일 오후 2시에 갔고 20분 기다렸어요. 주차비 2,000원.';
  const found = factCheck(body, '소금빵 3500원\n12월3일 다녀옴\n오후 2시');
  expect(found).toEqual(['4500원', '2,000원', '20분']);
  expect(factCheck('가격은 [작성자 확인 필요]', '')).toEqual([]);
});

test('작성 품질 점검: 핵심어 반복·긴 문단·사진 자리·상투 표현·광고 표시', () => {
  const long = '가'.repeat(320);
  const items = qualityCheck({ title: '성수 카페', body: `성수카페 좋아요.\n${long}\n[사진 1]\n[사진 1]\n결론적으로 다양한 메뉴가 완벽한 곳.`, hashtags: ['성수카페'], photos: 2, postType: 'sponsored' }, null);
  const bad = Object.fromEntries(items.filter(i => !i.ok).map(i => [i.label, i.hint]));
  expect(bad["핵심어 '성수카페' 본문 2~8번"]).toBe('지금 1번');
  expect(bad['긴 문단 없음(300자 넘는 문단)']).toContain('1개');
  expect(bad['사진 자리 빠짐·겹침 없음']).toBe('빠짐: 사진 2 · 두 번: 사진 1');
  expect(bad['AI 티 나는 상투 표현 2개 이하']).toBe('결론적으로, 다양한, 완벽한');
  expect(bad['광고·협찬 표시 문구']).toBeTruthy();
  const ok = qualityCheck({ title: 't', body: '업체로부터 제공받아 썼어요. 성수카페 첫 방문.\n성수카페 두 번째.\n[사진 1]\n[사진 2]', hashtags: ['성수카페'], photos: 2, postType: 'sponsored' }, null);
  expect(ok.every(i => i.ok)).toBe(true);
  // 200자 넘는 후기 글은 아쉬운 점 한 줄을 본다
  const review = (extra: string) => qualityCheck({ title: 't', body: `${'맛있어요 '.repeat(50)}${extra}`, hashtags: [], photos: 0, postType: 'food' }, null).find(i => i.label === '아쉬운 점 한 줄(후기 글)')?.ok;
  expect(review('')).toBe(false);
  expect(review('웨이팅이 길어서 아쉬웠어요.')).toBe(true);
  expect(emptyOutline('가게 이름·위치: 성수빵집\n주문한 메뉴와 가격: \n맛·양·식감:')).toEqual(['주문한 메뉴와 가격', '맛·양·식감']);
});

test('사진마다 메모를 적으면 AI 초안 재료로 들어가고, 근거 없는 숫자는 사실 확인에 뜬다', async ({ page }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.locator('input[type=file]').setInputFiles(files);
  await expect(page.getByRole('img', { name: /^사진 2:/ })).toBeVisible();
  const memo = page.getByLabel('사진 1 메모');
  await memo.fill('소금빵 3,500원, 겉바속촉');
  const saved = page.waitForResponse(r => r.url().includes('/api/photos/') && r.request().method() === 'PATCH');
  await page.getByLabel('사진 2 메모').click(); // 칸을 벗어나면 저장
  expect((await saved).status()).toBe(200);
  await expect(page.getByText('1/2장 · 선택')).toBeVisible();

  await page.getByLabel(/직접 겪은 내용/).fill('토요일에 성수 빵집에 다녀왔어요. 소금빵이 맛있었어요.');
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByLabel('본문')).toHaveValue(/메모 반영: 사진 1: 소금빵 3,500원, 겉바속촉/);
  const check = page.locator('section').filter({ has: page.getByRole('heading', { name: '원고 점검' }) });
  await expect(check.getByLabel('사실 확인')).toContainText('9,900원'); // 메모·경험에 없는 가격
  await expect(check.getByLabel('사실 확인')).not.toContainText('3,500원');
  await expect(check).toContainText("'[작성자 확인 필요]' 모두 고치기");
  await expect(check).toContainText('네이버 검색 점수나 상위 노출을 뜻하지 않아요');

  // 새로고침해도 메모가 남고, 다른 사용자는 남의 사진 메모를 못 바꾼다
  await page.reload();
  await page.getByRole('button', { name: /가짜 Gemini가 쓴 제목/ }).first().click();
  await expect(page.getByLabel('사진 1 메모')).toHaveValue('소금빵 3,500원, 겉바속촉');
  const photoId = await page.evaluate(() => (document.querySelector('.photo img') as HTMLImageElement).src.split('/').pop());
  const other = await page.context().browser()!.newContext({ baseURL: test.info().project.use.baseURL });
  const otherPage = await other.newPage();
  await login(otherPage, CODE_D);
  const res = await otherPage.evaluate(async id => (await fetch(`/api/photos/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note: '남의 메모' }) })).status, photoId);
  expect(res).toBe(404);
  await other.close();
  const bad = await page.evaluate(async id => (await fetch(`/api/photos/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note: 3 }) })).status, photoId);
  expect(bad).toBe(400);

  await page.evaluate(async () => { for (const d of (await (await fetch('/api/drafts')).json()).drafts) await fetch(`/api/drafts/${d.id}`, { method: 'DELETE' }); });
});

test('체험단 공고: 관심으로 담고 → 신청 → 선정까지 목록에서 넘기고, 공고 주소는 https만', async ({ page }) => {
  await login(page, CODE_C);
  const bad = await page.evaluate(async () => (await fetch('/api/campaigns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brand: 'x', status: 'interested', source_url: 'javascript:alert(1)' }) })).status);
  expect(bad).toBe(400);

  await page.getByRole('button', { name: '협찬', exact: true }).click();
  await page.getByRole('button', { name: '새 협찬' }).click();
  await page.getByLabel('상태').selectOption({ label: '관심' });
  await page.getByLabel('업체').fill('공고빵집');
  await page.getByLabel('모집 공고 주소(선택)').fill('https://example.com/campaign/1');
  await page.getByLabel('신청 기한(선택)').fill('2099-01-05');
  await page.getByRole('button', { name: '저장' }).click();
  await page.getByRole('tab', { name: '관심·신청' }).click();
  const row = page.locator('.campaigns li').filter({ hasText: '공고빵집' });
  await expect(row).toContainText('신청 01/05');
  await expect(row.getByRole('link', { name: '공고 열기' })).toHaveAttribute('href', 'https://example.com/campaign/1');
  await expect(row.getByRole('link', { name: '공고 열기' })).toHaveAttribute('rel', 'noopener noreferrer');
  // 관심은 받을 금액(진행 중)에 들어가지 않는다
  await page.getByRole('tab', { name: '진행 중' }).click();
  await expect(page.locator('.campaigns li').filter({ hasText: '공고빵집' })).toHaveCount(0);
  await page.getByRole('tab', { name: '관심·신청' }).click();
  await row.getByRole('button', { name: '신청했어요' }).click();
  await expect(row).toContainText('신청함');
  await row.getByRole('button', { name: '선정됐어요' }).click();
  await expect(page.getByRole('status')).toContainText('선정!');
  await page.getByRole('tab', { name: '진행 중' }).click();
  await expect(page.locator('.campaigns li').filter({ hasText: '공고빵집' })).toContainText('진행 중');

  await page.evaluate(async () => { for (const c of (await (await fetch('/api/campaigns')).json()).campaigns) await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' }); });
});
