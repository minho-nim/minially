import { expect, test, type Page } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';
import { readLogin, seal, unseal } from '../functions/_creds';

test('연결 규칙: 아이디·앱 비밀번호 검사, 암호화는 사람·계정에 묶여 다른 줄로 옮기면 안 풀림', async () => {
  expect(readLogin('naver', 'Tomong', 'abcd1234')).toEqual({ login: 'tomong@naver.com', password: 'abcd1234' });
  expect(readLogin('gmail', 'to@gmail.com', 'abcd efgh ijkl mnop')).toEqual({ login: 'to@gmail.com', password: 'abcdefghijklmnop' });
  expect(typeof readLogin('naver', 'a@daum.net', 'abcd1234')).toBe('string');
  expect(typeof readLogin('gmail', 'not-mail', 'abcd1234')).toBe('string');
  expect(typeof readLogin('naver', 'tomong', 'ab\ncd')).toBe('string'); // 줄바꿈 든 비밀번호
  const env = { CRED_KEY: Buffer.alloc(32, 9).toString('base64') };
  const s = await seal(env, 'C', 'naver', 'secret-pass');
  expect(s).toMatch(/^v1\./); expect(s).not.toContain('secret-pass');
  expect(await unseal(env, 'C', 'naver', s!)).toBe('secret-pass');
  expect(await unseal(env, 'D', 'naver', s!)).toBeNull(); // 다른 사람 줄로 옮기면 안 풀림
  expect(await unseal(env, 'C', 'gmail', s!)).toBeNull();
  expect(await unseal({ CRED_KEY: Buffer.alloc(32, 1).toString('base64') }, 'C', 'naver', s!)).toBeNull();
  expect(await seal({}, 'C', 'naver', 'x')).toBeNull(); // 키가 없으면 저장 안 함
});

async function state(page: Page) { return page.evaluate(async () => { const r = await fetch('/api/connections'); return { status: r.status, text: await r.text() }; }); }

test('연결 창: 단계마다 아래 버튼 자리 고정, 틀린 비밀번호는 저장 안 함, 맞으면 암호화 저장·메일 계정에 보임·끊기, 남의 연결에 안 섞임', async ({ page, request }) => {
  expect((await request.get('/api/connections')).status()).toBe(401);
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page, CODE_D);
  await page.getByRole('button', { name: '설정', exact: true }).click();
  const card = page.locator('section[aria-labelledby="connect-title"]');
  await expect(card.getByRole('listitem').filter({ hasText: 'Gmail' })).toContainText('연결 안 함');
  await card.getByRole('listitem').filter({ hasText: 'Gmail' }).getByRole('button', { name: '연결하기' }).click();
  const wiz = page.getByRole('dialog');
  await expect(wiz.getByRole('heading', { name: 'Gmail 앱 비밀번호 만들기' })).toBeVisible();
  const next = wiz.locator('.wiz-foot .btn.primary'), back = wiz.locator('.wiz-foot .btn.ghost');
  const spots: string[] = [];
  // 다음 버튼은 오른쪽 끝·높이, 이전 버튼은 왼쪽 끝·높이가 같으면 같은 자리(글자 길이만 다름)
  const spot = async () => { const a = await next.boundingBox(), b = await back.boundingBox(); spots.push(JSON.stringify([Math.round((a?.x ?? 0) + (a?.width ?? 0)), Math.round(a?.y ?? 0), Math.round(b?.x ?? 0), Math.round(b?.y ?? 0)])); };
  await spot();
  await next.click(); await spot(); // 2번째 그림
  await next.click(); await spot(); // 3번째 그림
  await expect(next).toHaveText('다음: 붙여 넣기 →');
  await next.click(); await spot();
  await expect(wiz.getByRole('heading', { name: /여기에 붙여 넣기/ })).toBeVisible();
  expect(new Set(spots), spots.join(' ')).toHaveProperty('size', 1); // 버튼 자리가 단계마다 같다

  await wiz.getByLabel('Gmail 주소').fill('d-test@gmail.com');
  await wiz.getByLabel(/앱 비밀번호/).fill('wrong-pass');
  await next.click();
  await expect(wiz.getByRole('alert')).toContainText('메일 로그인에 실패했어요');
  await spot(); expect(new Set(spots).size).toBe(1);
  expect(JSON.parse((await state(page)).text).accounts.find((a: { provider: string }) => a.provider === 'gmail').connected).toBe(false);

  await next.click(); // 다시 붙여 넣기
  await wiz.getByLabel(/앱 비밀번호/).fill('app-pass');
  await next.click();
  await expect(wiz.getByRole('status')).toContainText('로그인 성공');
  await next.click(); // 닫기
  await expect(wiz).toHaveCount(0);
  await expect(card.getByRole('listitem').filter({ hasText: 'Gmail' })).toContainText('연결됨 · d-***@gmail.com');
  const s = await state(page);
  expect(s.text).not.toContain('app-pass');
  expect(JSON.parse(s.text).accounts.find((a: { provider: string }) => a.provider === 'gmail')).toMatchObject({ connected: true, source: 'app' });
  const mail = await page.evaluate(async () => (await (await fetch('/api/mail')).json()) as { accounts: { provider: string }[] });
  expect(mail.accounts.map(a => a.provider)).toEqual(['gmail']);

  // C는 관리자 비밀값 연결 그대로(D 것이 섞이지 않음)
  const c = await (await page.context().browser()!.newContext()).newPage();
  await login(c, CODE_C);
  const cs = JSON.parse((await state(c)).text) as { accounts: { provider: string; source: string; address: string }[] };
  expect(cs.accounts.map(a => [a.provider, a.source])).toEqual([['naver', 'admin'], ['gmail', 'admin']]);
  expect(cs.accounts[1].address).toBe('c-***@gmail.com');
  await c.context().close();

  // 끊기 → 연결 안 함
  await card.getByRole('button', { name: 'Gmail 연결 끊기' }).click();
  await expect(card.getByRole('listitem').filter({ hasText: 'Gmail' })).toContainText('연결 안 함');
  expect(await page.evaluate(async () => (await fetch('/api/connections', { method: 'PUT', body: JSON.stringify({ provider: 'yahoo', login: 'a', password: 'b' }) })).status)).toBe(400);
});
