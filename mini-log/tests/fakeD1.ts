// 실제 SQL(node:sqlite)로 D1을 흉내 낸다. seen에는 prepare한 SQL이 쌓인다(쿼리 수 시험용).
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '../../shared/server/d1';

export function fakeD1(sqlite = new DatabaseSync(':memory:'), seen: string[] = []): D1Database {
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
