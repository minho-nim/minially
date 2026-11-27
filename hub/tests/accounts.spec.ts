import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { CODE_C } from '../playwright.config';

const D1_DIR = '.wrangler/test-state/v3/d1/miniflare-D1DatabaseObject';
const dbFile = () => `${D1_DIR}/${readdirSync(D1_DIR).find(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite')}`;

test('계정: 통합 대시보드에서 두 사람의 블로그·SNS 아이디를 보고, 로그인 없이는 볼 수 없다', async ({ page, request }) => {
  expect((await request.get('/api/accounts')).status()).toBe(401);
  await page.goto('/');
  await page.getByLabel('로그인 코드').fill(CODE_C);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('heading', { name: /님, 오늘도 반가워요/ })).toBeVisible();
  const db = new DatabaseSync(dbFile());
  db.prepare("INSERT OR REPLACE INTO minilog_accounts (user, platform, handle, updated_at) VALUES ('D', 'instagram', 'd_daily.log', 1)").run();
  db.prepare("INSERT OR IGNORE INTO minilog_blogs (user, blog_id, created_at) VALUES ('C', 'cblog', 1)").run();
  db.close();
  await page.reload(); // 로그인하면서 이미 불러온 계정 목록이 있을 수 있어, 넣은 뒤 다시 불러온다(hub.spec과 같은 방식)
  await page.getByRole('button', { name: '두 사람 같이' }).click();
  const panel = page.locator('#accounts');
  await expect(panel).toContainText('비밀번호는 저장하지 않아요');
  await expect(panel.getByRole('link', { name: '@d_daily.log' })).toHaveAttribute('href', 'https://www.instagram.com/d_daily.log/');
  await expect(panel.getByRole('link', { name: /네이버 cblog/ })).toHaveAttribute('href', 'https://blog.naver.com/cblog');
  const db2 = new DatabaseSync(dbFile());
  db2.exec("DELETE FROM minilog_accounts WHERE user = 'D'; DELETE FROM minilog_blogs WHERE user = 'C' AND blog_id = 'cblog'");
  db2.close();
});
