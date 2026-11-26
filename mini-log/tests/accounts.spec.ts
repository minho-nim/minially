import { expect, test } from '@playwright/test';
import { CODE_C, CODE_D } from '../playwright.config';
import { login } from './helpers';

test('SNS 아이디 읽기: @·프로필 주소를 아이디로, 형식이 틀리면 거절', async () => {
  const { readHandle } = await import('../../shared/server/accounts');
  expect(readHandle('instagram', '@my.blog_life')).toBe('my.blog_life');
  expect(readHandle('instagram', 'https://www.instagram.com/my.blog_life/?hl=ko')).toBe('my.blog_life');
  expect(readHandle('threads', 'https://www.threads.net/@tomong')).toBe('tomong');
  expect(readHandle('x', 'https://twitter.com/tomong_x')).toBe('tomong_x');
  expect(readHandle('youtube', 'https://www.youtube.com/@tomong-tv')).toBe('tomong-tv');
  expect(readHandle('x', 'this_is_too_long_for_x')).toBeNull();
  expect(readHandle('instagram', '<script>')).toBeNull();
  expect(readHandle('instagram', '')).toBe('');
});

test('내 계정: 블로그·SNS 아이디·연락 이메일을 보고 아이디를 저장·지우며, 다른 사람 것은 섞이지 않는다', async ({ page, browser, request }) => {
  expect((await request.get('/api/accounts')).status()).toBe(401);
  await login(page, CODE_D);
  const bad = await page.evaluate(async () => [
    (await fetch('/api/accounts', { method: 'PUT', body: JSON.stringify({ platform: 'facebook', handle: 'a' }) })).status,
    (await fetch('/api/accounts', { method: 'PUT', body: JSON.stringify({ platform: 'x', handle: 'a b' }) })).status,
  ]);
  expect(bad).toEqual([400, 400]);
  await page.getByRole('button', { name: '설정', exact: true }).click(); // 계정·백업은 설정 화면으로 옮김
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: '내 계정' }) });
  await expect(card).toContainText('비밀번호는 묻지도 저장하지도 않아요');
  await card.getByRole('textbox', { name: '인스타그램' }).fill('https://www.instagram.com/d_daily.log/');
  await card.getByRole('button', { name: '인스타그램 아이디 저장' }).click();
  await expect(card.getByRole('link', { name: '@d_daily.log' })).toHaveAttribute('href', 'https://www.instagram.com/d_daily.log/');
  await expect(card).toContainText('네이버 블로그');
  // 다른 사용자(C)에게는 D의 아이디가 보이지 않는다
  const other = await browser.newPage();
  await login(other, CODE_C);
  const c = await other.evaluate(async () => (await fetch('/api/accounts')).json());
  expect(c.user).toBe('C');
  expect(JSON.stringify(c)).not.toContain('d_daily.log');
  await other.close();
  // 지우기
  await card.getByRole('textbox', { name: '인스타그램' }).fill('');
  await card.getByRole('button', { name: '인스타그램 아이디 저장' }).click();
  await expect(card.getByRole('link', { name: '@d_daily.log' })).toHaveCount(0);
});
