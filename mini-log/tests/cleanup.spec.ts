// 게시 후 30일이 지난 사진 정리: 실제 SQL(node:sqlite)로 D1을 흉내 내 시간이 흐른 상황을 시험한다.
import { expect, test } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, R2Bucket } from '../../shared/server/d1';
import { ensureHubSchema, SCHEMA_VERSION } from '../../shared/server/schema';
import { secretEquals } from '../../shared/server/auth';
import { createDraft, updateDraft } from '../functions/_drafts';
import { addPhoto, cleanupExpired, listPhotos } from '../functions/_photos';

function fakeD1(sqlite = new DatabaseSync(':memory:'), seen: string[] = []): D1Database {
  const statement = (sql: string, values: unknown[] = []) => ({
    bind: (...next: unknown[]) => statement(sql, next),
    all: async <T>() => ({ results: sqlite.prepare(sql).all(...(values as never[])) as T[] }),
    first: async <T>() => (sqlite.prepare(sql).get(...(values as never[])) as T) ?? null,
    run: async () => sqlite.prepare(sql).run(...(values as never[])),
    _run: () => sqlite.prepare(sql).run(...(values as never[])),
  });
  return {
    prepare: (sql: string) => { seen.push(sql); return statement(sql); },
    batch: async statements => statements.map(s => (s as unknown as { _run: () => unknown })._run()),
  };
}

function fakeR2() {
  const store = new Map<string, Uint8Array>();
  const bucket: R2Bucket = {
    put: async (key, value) => { store.set(key, value instanceof Uint8Array ? value : new Uint8Array(value)); },
    get: async key => { const v = store.get(key); return v ? { body: new Response(new Blob([v as BlobPart])).body!, size: v.byteLength } : null; },
    delete: async keys => { for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k); },
  };
  return { bucket, store };
}

test('게시 30일이 지나면 그 사용자 사진만 지우고, 게시 안 한 원고 사진은 남긴다', async () => {
  const db = fakeD1();
  const { bucket, store } = fakeR2();
  await ensureHubSchema(db);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const published = await createDraft(db, 'C');
  const kept = await createDraft(db, 'C');
  const other = await createDraft(db, 'D');
  await addPhoto(db, bucket, 'C', published.id, jpg, 'image/jpeg', 'a', null);
  await addPhoto(db, bucket, 'C', kept.id, jpg, 'image/jpeg', 'b', null);
  await addPhoto(db, bucket, 'D', other.id, jpg, 'image/jpeg', 'c', Date.now() - 1); // D의 만료 사진(C 정리 때 건드리면 안 됨)
  expect(await updateDraft(db, 'C', published.id, { status: 'published' })).toBe('게시 완료하려면 게시한 글 주소를 넣어 주세요.');
  await updateDraft(db, 'C', published.id, { status: 'published', published_url: 'https://blog.naver.com/x/1' });
  const expires = (await listPhotos(db, 'C', published.id))[0].expires_at!;
  expect(Math.round((expires - Date.now()) / 86400000)).toBe(30);

  expect(await cleanupExpired(db, bucket, 'C', Date.now() + 29 * 86400000)).toBe(0); // 29일째: 아직
  expect(await cleanupExpired(db, bucket, 'C', Date.now() + 31 * 86400000)).toBe(1); // 31일째: 지움
  expect(await listPhotos(db, 'C', published.id)).toHaveLength(0);
  expect(await listPhotos(db, 'C', kept.id)).toHaveLength(1);
  expect(await listPhotos(db, 'D', other.id)).toHaveLength(1);
  expect([...store.keys()].sort()).toEqual([`C/${kept.id}/${(await listPhotos(db, 'C', kept.id))[0].id}`, `D/${other.id}/${(await listPhotos(db, 'D', other.id))[0].id}`].sort());
});

test('운영 DB처럼 원고 표가 이미 있으면 게시 예정일 칸만 더하고 기존 원고는 그대로 둔다', async () => {
  const db = fakeD1();
  // 예전 구조(planned_on 없음)로 먼저 만든 표 + 기존 원고 1개
  await db.prepare("CREATE TABLE minilog_drafts (id TEXT PRIMARY KEY, user TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', hashtags TEXT NOT NULL DEFAULT '', experience TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', published_url TEXT NOT NULL DEFAULT '', published_at INTEGER, style_id TEXT NOT NULL DEFAULT 'mine', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)").run();
  await db.prepare("INSERT INTO minilog_drafts (id, user, title, created_at, updated_at) VALUES ('old', 'C', '예전 원고', 1, 1)").run();
  await ensureHubSchema(db);
  await ensureHubSchema(db); // 두 번 돌려도 오류 없음
  const row = await db.prepare("SELECT title, planned_on FROM minilog_drafts WHERE id = 'old'").first<{ title: string; planned_on: string | null }>();
  expect(row).toEqual({ title: '예전 원고', planned_on: null });
  const made = await createDraft(db, 'C', '2026-12-24');
  expect(made.planned_on).toBe('2026-12-24');
});

test('표 구조가 이미 최신이면 바인딩 객체가 새로 와도 읽기 한 번으로 끝낸다', async () => {
  const sqlite = new DatabaseSync(':memory:');
  await ensureHubSchema(fakeD1(sqlite));
  expect(sqlite.prepare('SELECT version FROM hub_schema_meta').get()).toEqual({ version: SCHEMA_VERSION });
  const seen: string[] = [];
  await ensureHubSchema(fakeD1(sqlite, seen)); // 요청마다 새 바인딩 객체가 오는 경우
  expect(seen).toEqual(['SELECT version FROM hub_schema_meta WHERE id = 1']);
  // 지문이 다르면(구조가 바뀐 새 배포) 다시 만들고 지문을 고친다
  sqlite.prepare("UPDATE hub_schema_meta SET version = 'old'").run();
  const again: string[] = [];
  await ensureHubSchema(fakeD1(sqlite, again));
  expect(again.some(sql => sql.startsWith('CREATE TABLE IF NOT EXISTS minilog_drafts'))).toBe(true);
  expect(sqlite.prepare('SELECT version FROM hub_schema_meta').get()).toEqual({ version: SCHEMA_VERSION });
});

test('비밀값 비교는 같을 때만 참이다', async () => {
  expect(await secretEquals('test-stats-token', 'test-stats-token')).toBe(true);
  expect(await secretEquals('test-stats-tokeN', 'test-stats-token')).toBe(false);
  expect(await secretEquals('', 'test-stats-token')).toBe(false);
  expect(await secretEquals('test-stats-token-longer', 'test-stats-token')).toBe(false);
});
