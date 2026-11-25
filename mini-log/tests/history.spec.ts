// 월별 내역·누적 합계: 달별로 묶어 센 값이 월간 보고(summary)와 똑같은지, 다른 사용자 숫자가 섞이지 않는지 실제 SQL로 시험한다.
import { expect, test } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { ensureHubSchema } from '../../shared/server/schema';
import { monthlyHistory, monthList, monthSummaryForTest } from '../../shared/server/report';
import { fakeD1 } from './fakeD1';

const kst = (iso: string) => Date.parse(`${iso}+09:00`);

test('월별 내역은 달마다 월간 보고 숫자와 같고, 누적 합계는 전체를 센다', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const db = fakeD1(sqlite);
  await ensureHubSchema(db);
  const run = (sql: string, ...v: unknown[]) => sqlite.prepare(sql).run(...(v as never[]));
  // 블로그 글(조회수 있는 것·없는 것, 오래된 달 포함)
  for (const [user, key, on, views] of [['C', 'a', '2026-11-03', 100], ['C', 'b', '2026-11-30', null], ['C', 'c', '2026-10-01', 50], ['C', 'd', '2025-01-15', 7], ['D', 'e', '2026-11-05', 999]] as const)
    run('INSERT INTO minilog_posts (user, post_key, url, title, published_on, views, likes, comments, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)', user, key, `https://blog.naver.com/x/${key}`, key, on, views, views === null ? null : 2, views === null ? null : 1);
  // 미니로그 게시: 한국 시간 달 경계(11월 1일 0시 = 10월 31일 15시 UTC)
  run("INSERT INTO minilog_drafts (id, user, status, published_url, published_at, created_at, updated_at) VALUES ('p1', 'C', 'published', 'https://x', ?, 1, 1)", kst('2026-11-01T00:00:00'));
  run("INSERT INTO minilog_drafts (id, user, status, published_url, published_at, created_at, updated_at) VALUES ('p2', 'C', 'published', 'https://x', ?, 1, 1)", kst('2026-10-31T23:59:59'));
  // 협찬·광고 수익과 협찬 건수(마감일과 받은 날이 다른 달인 것, 같은 달인 것)
  for (const [id, user, kind, status, amount, deadline, paid] of [['s1', 'C', 'sponsor', 'paid', 30000, '2026-10-28', '2026-11-02'], ['s2', 'C', 'sponsor', 'paid', 20000, '2026-11-10', '2026-11-20'], ['s3', 'C', 'ad', 'paid', 1234, null, '2026-11-30'], ['s4', 'C', 'sponsor', 'posted', 0, '2026-09-09', null], ['s5', 'D', 'sponsor', 'paid', 777, '2026-11-01', '2026-11-01'], ['s6', 'C', 'other', 'paid', 500, null, '2024-12-31']] as const)
    run('INSERT INTO minilog_campaigns (id, user, kind, status, amount, deadline, paid_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)', id, user, kind, status, amount, deadline, paid);
  // AI 사용량(경계 포함)
  for (const [user, at, status] of [['C', '2026-11-01T00:00:00', 'ok'], ['C', '2026-10-31T23:59:59', 'error'], ['C', '2026-11-15T12:00:00', 'ok'], ['D', '2026-11-15T12:00:00', 'ok']] as const)
    run("INSERT INTO ai_usage (user, app, model, task, input_tokens, output_tokens, status, created_at) VALUES (?, 'minilog', 'm', 't', 10, 5, ?, ?)", user, status, kst(at));

  const history = await monthlyHistory(db, 'C', '2026-11', 12);
  expect(history.months.map(m => m.month)).toEqual(monthList('2026-11', 12));
  expect(history.months[0].month).toBe('2025-12');
  for (const row of history.months) {
    const { month, ...counted } = row;
    expect(counted, month).toEqual(await monthSummaryForTest(db, 'C', month));
  }
  const nov = history.months.at(-1)!, oct = history.months.at(-2)!;
  expect(nov).toMatchObject({ posts: 2, views: 100, with_stats: 1, minilog_published: 1, revenue: 51234, sponsor_revenue: 50000, ad_revenue: 1234, sponsor_count: 2, ai_calls: 2, ai_errors: 0 });
  expect(oct).toMatchObject({ posts: 1, minilog_published: 1, sponsor_count: 1, ai_calls: 1, ai_errors: 1 });
  // 누적 합계: 12개월 밖(2025-01 글, 2024-12 수익)까지 전부, D 숫자는 빠짐
  expect(history.total).toEqual({ posts: 4, minilog_published: 2, views: 157, likes: 6, comments: 3, revenue: 51734, sponsor_count: 3, ai_calls: 3, ai_tokens: 45, first_month: '2025-01' });
  const d = await monthlyHistory(db, 'D', '2026-11', 3);
  expect(d.total).toMatchObject({ posts: 1, views: 999, revenue: 777, ai_calls: 1 });
  expect(d.months.map(m => m.month)).toEqual(['2026-09', '2026-10', '2026-11']);
});
