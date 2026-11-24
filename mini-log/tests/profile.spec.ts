import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { CODE_C } from '../playwright.config';
import { login } from './helpers';

const D1_DIR = '.wrangler/test-state/v3/d1/miniflare-D1DatabaseObject';

test('hub에서 바꾼 이름·테마가 mini-log에 보이고, hub 링크는 "hub"로 표시', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('코드를 입력해 주세요')).toBeVisible();
  await expect(page.getByLabel('로그인 코드')).toHaveAttribute('autocomplete', 'current-password');
  await login(page, CODE_C);
  await expect(page.locator('.side-foot').getByRole('link', { name: 'hub', exact: true })).toBeVisible();
  await expect(page.getByText('미니허브')).toHaveCount(0);
  // hub 설정과 같은 표(hub_profiles)에 직접 넣는다(hub는 다른 시험 서버)
  const file = readdirSync(D1_DIR).find(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
  const db = new DatabaseSync(`${D1_DIR}/${file}`);
  db.prepare("INSERT OR REPLACE INTO hub_profiles (user, name, theme, updated_at) VALUES ('C', '토마토', 'dark', ?)").run(Date.now());
  db.close();
  await page.reload();
  await expect(page.locator('.side-name')).toHaveText('토마토');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // 되돌리기(다른 시험은 '사용자 C'를 본다)
  const db2 = new DatabaseSync(`${D1_DIR}/${file}`);
  db2.prepare("DELETE FROM hub_profiles WHERE user = 'C'").run();
  db2.close();
  await page.reload();
  await expect(page.locator('.side-name')).toHaveText('사용자 C');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
});
