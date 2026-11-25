// 원고 목록 200개씩 나누기: 같은 수정 시각이 쪽 경계에 걸려도 빠지거나 겹치지 않고, 오래된 게시 예정 원고는 첫 쪽에 함께 온다.
import { expect, test } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { ensureHubSchema } from '../../shared/server/schema';
import { DRAFT_PAGE, listDrafts } from '../functions/_drafts';
import { fakeD1 } from './fakeD1';

test('200개씩 나누어도 모든 원고가 한 번씩만 나오고, 오래된 게시 예정 원고는 첫 쪽에 더해진다', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const db = fakeD1(sqlite);
  await ensureHubSchema(db);
  const ins = sqlite.prepare("INSERT INTO minilog_drafts (id, user, title, status, planned_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?)");
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  // 250개: 190~210번째(200번째 쪽 경계를 가로지름)는 수정 시각이 모두 같다
  for (let n = 0; n < 250; n++) ins.run(id(n), 'C', `원고 ${n}`, 'draft', null, n < 190 ? 10000 - n : n <= 210 ? 5000 : 4000 - n);
  ins.run(id(900), 'C', '오래된 게시 예정', 'draft', '2026-12-24', 1);
  ins.run(id(901), 'C', '오래된 게시 완료', 'published', '2026-01-02', 1);
  ins.run(id(902), 'D', 'D 원고', 'draft', '2026-12-24', 1);

  const first = await listDrafts(db, 'C');
  expect(first.more).toBe(true);
  expect(first.drafts.slice(0, DRAFT_PAGE)).toHaveLength(DRAFT_PAGE);
  const extra = first.drafts.slice(DRAFT_PAGE).map(d => d.title);
  expect(extra).toEqual(['오래된 게시 예정']); // 게시 완료·다른 사람 원고는 안 더함
  const seen = new Set(first.drafts.slice(0, DRAFT_PAGE).map(d => d.id));
  const cursor = first.next_before!;
  expect(cursor.startsWith('5000_')).toBe(true); // 경계가 같은 시각 묶음 한가운데
  const [at, cid] = [Number(cursor.split('_')[0]), cursor.split('_').slice(1).join('_')];
  const second = await listDrafts(db, 'C', { at, id: cid });
  for (const d of second.drafts) { expect(seen.has(d.id), d.title).toBe(false); seen.add(d.id); }
  expect(second.more).toBe(false);
  expect(seen.size).toBe(252); // 250 + 오래된 2개, 빠지거나 겹친 것 없음
  expect(seen.has(id(902))).toBe(false);
});
