import { expect, test, type Page } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';

async function login(page: Page, code: string) {
  await page.goto('/');
  await page.getByLabel('로그인 코드').fill(code);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('button', { name: '새 원고' })).toBeVisible();
}

test('틀린 코드는 거절하고, 맞는 코드로 로그인·로그아웃한다', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await page.getByLabel('로그인 코드').fill('WRONG-CODE-0000');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('alert')).toHaveText('코드가 맞지 않습니다.');
  errors.length = 0; // 틀린 코드의 401은 일부러 낸 것
  await page.getByLabel('로그인 코드').fill(CODE_C.toLowerCase());
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByText('사용자 C')).toBeVisible();
  await page.reload();
  await expect(page.getByText('사용자 C')).toBeVisible();
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByLabel('로그인 코드')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('로그인 코드')).toBeVisible();
  expect(errors).toEqual([]);
});

test('원고를 만들고 AI 초안·자동 저장·승인·삭제를 한다', async ({ page }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel(/직접 겪은 내용/).fill('토요일 오후에 동네 빵집에 다녀왔어요. 소금빵이 맛있었어요.');
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('가짜 Gemini가 쓴 제목');
  await expect(page.getByLabel('해시태그')).toHaveValue('#시험 #미니로그');
  await page.getByLabel('본문').fill('직접 고친 본문');
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.getByRole('button', { name: '원고 승인' }).click();
  await expect(page.getByText('저장됨')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /가짜 Gemini가 쓴 제목/ }).click();
  await expect(page.getByLabel('본문')).toHaveValue('직접 고친 본문');
  await expect(page.locator('.badge')).toHaveText('승인됨');
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByText('아직 원고가 없어요')).toBeVisible();
});

test('Gemini 호출 제한·한도 초과를 알기 쉽게 알린다', async ({ page }) => {
  await login(page, CODE_C);
  await page.getByRole('button', { name: '새 원고' }).click();
  await page.getByLabel(/직접 겪은 내용/).fill('RATE-LIMIT 시험용 경험 글입니다.');
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByRole('alert')).toContainText('잠시 너무 많아요');
  await page.getByLabel(/직접 겪은 내용/).fill('QUOTA-OVER 시험용 경험 글입니다.');
  await page.getByRole('button', { name: 'AI로 초안 만들기' }).click();
  await expect(page.getByRole('alert')).toContainText('사용 한도를 넘었어요');
});

test('사용자별 데이터가 완전히 나뉜다(남의 원고는 못 보고 못 고침)', async ({ browser }) => {
  const c = await browser.newPage();
  await login(c, CODE_C);
  const created = await c.evaluate(async () => (await (await fetch('/api/drafts', { method: 'POST' })).json()).draft.id as string);
  const d = await browser.newPage();
  await login(d, CODE_D);
  // D는 Gemini 키가 없다.
  await d.getByRole('button', { name: '새 원고' }).click();
  await expect(d.getByRole('button', { name: 'AI로 초안 만들기' })).toBeDisabled();
  const result = await d.evaluate(async id => ({
    list: (await (await fetch('/api/drafts')).json()).drafts.map((x: { id: string }) => x.id),
    get: (await fetch(`/api/drafts/${id}`)).status,
    put: (await fetch(`/api/drafts/${id}`, { method: 'PUT', body: JSON.stringify({ title: '남의 원고' }) })).status,
  }), created);
  expect(result.list).not.toContain(created);
  expect(result.get).toBe(404);
  expect(result.put).toBe(404);
  // 다른 사이트에서 보낸 요청(Origin이 다름)은 로그인 쿠키가 있어도 막힌다.
  const cookie = (await c.context().cookies()).map(k => `${k.name}=${k.value}`).join('; ');
  const cross = await c.request.post('/api/drafts', { headers: { origin: 'https://evil.example', cookie } });
  expect(cross.status()).toBe(403);
  // 로그인하지 않은 요청은 막힌다.
  const anon = await (await browser.newContext()).newPage();
  await anon.goto('/version.json');
  expect(await anon.evaluate(async () => (await fetch('/api/drafts')).status)).toBe(401);
});

for (const [name, width] of [['PC', 1400], ['휴대폰', 400]] as const) {
  test(`${name} 폭에서 가로 넘침·콘솔 오류가 없다`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewportSize({ width, height: 900 });
    await login(page, CODE_C);
    await page.getByRole('button', { name: '새 원고' }).click();
    await page.getByLabel('제목').fill('아주 긴 제목'.repeat(20));
    await expect(page.getByText('저장됨')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}
