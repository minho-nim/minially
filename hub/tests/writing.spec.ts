import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { CODE_C } from '../playwright.config';

const D1_DIR = '.wrangler/test-state/v3/d1/miniflare-D1DatabaseObject';
const dbFile = () => `${D1_DIR}/${readdirSync(D1_DIR).find(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite')}`;

test('통합 대시보드: 사람마다 자주 쓰는 글 종류(미니로그 원고 수, 많은 순 3개)를 본다', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('로그인 코드').fill(CODE_C);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.locator('.scope')).toBeVisible();
  const db = new DatabaseSync(dbFile());
  const now = Date.now();
  const add = db.prepare("INSERT INTO minilog_drafts (id, user, status, post_type, created_at, updated_at) VALUES (?, ?, 'draft', ?, ?, ?)");
  [['t1', 'C', 'cafe'], ['t2', 'C', 'cafe'], ['t3', 'C', 'food'], ['t4', 'C', 'none'], ['t5', 'D', 'beauty'], ['t6', 'D', 'travel'], ['t7', 'D', 'beauty'], ['t8', 'D', 'daily'], ['t9', 'D', 'info']]
    .forEach(([id, user, type]) => add.run(id, user, type, now, now));
  db.close();
  await page.reload();
  await page.getByRole('button', { name: '통합 대시보드' }).click();
  await expect(page.getByLabel('사용자 C 자주 쓰는 글 종류')).toHaveText(/카페 2\s*맛집 1/);
  const d = page.getByLabel('사용자 D 자주 쓰는 글 종류');
  await expect(d).toContainText('뷰티 2');
  await expect(d.locator('.type-chip')).toHaveCount(3); // 많은 순 3개까지
  const db2 = new DatabaseSync(dbFile());
  db2.exec("DELETE FROM minilog_drafts WHERE id IN ('t1','t2','t3','t4','t5','t6','t7','t8','t9')");
  db2.close();
});
