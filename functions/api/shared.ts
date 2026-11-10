// 공유 받은 일정 보기(공유 코드, 보기 전용).
// 주인이 고른 카테고리의 일정과(켜 두었으면) 할 일만 돌려준다. 걸러내기는 반드시 서버에서 한다.
import { json, ensureSchema, sha256Hex, bearer, blocked, recordFailure, tooManyResponse, type Context } from '../_lib';

interface Share { categoryIds?: string[]; includeTasks?: boolean; name?: string }
type Item = Record<string, unknown> & { id: string };

export const onRequestGet = async ({ request, env }: Context): Promise<Response> => {
  if (!env.DB) return json({ error: '서버 동기화가 아직 설정되지 않았습니다.' }, 503);
  const db = env.DB;
  await ensureSchema(db);
  if (await blocked(db, request)) return tooManyResponse();
  const code = bearer(request);
  const row = code.length < 12 ? null : await db.prepare('SELECT space FROM sync_shares WHERE share_hash = ?').bind(await sha256Hex(code)).first<{ space: string }>();
  if (!row) { await recordFailure(db, request); return json({ error: '공유 코드가 맞지 않거나 공유가 꺼져 있어요.' }, 401); }

  const rows = await db
    .prepare("SELECT store, data FROM sync_records WHERE space = ? AND data IS NOT NULL AND store IN ('schedules','recurrenceRules','recurrenceExceptions','tasks','categories','appSettings')")
    .bind(row.space)
    .all<{ store: string; data: string }>();
  const by: Record<string, Item[]> = {};
  for (const r of rows.results) (by[r.store] ??= []).push(JSON.parse(r.data));

  const share: Share = ((by.appSettings ?? []).find(s => s.id === 'global_settings')?.share as Share) ?? {};
  const allowed = new Set(Array.isArray(share.categoryIds) ? share.categoryIds : []);
  const schedules = (by.schedules ?? []).filter(s => allowed.has(String(s.category)));
  const scheduleIds = new Set(schedules.map(s => s.id));
  const rules = (by.recurrenceRules ?? []).filter(r => scheduleIds.has(String(r.scheduleId)));
  const ruleIds = new Set(rules.map(r => r.id));
  // 반복 일정의 한 회차를 공유하지 않는 카테고리로 바꿨다면 그 회차는 숨긴다.
  const exceptions = (by.recurrenceExceptions ?? []).filter(ex => ruleIds.has(String(ex.ruleId))).map(ex => {
    const modified = ex.modifiedSchedule as { category?: string } | undefined;
    return modified?.category !== undefined && !allowed.has(modified.category) ? { ...ex, action: 'cancelled', modifiedSchedule: undefined } : ex;
  });
  const categories = (by.categories ?? []).filter(c => allowed.has(c.id)).map(c => ({ id: c.id, name: c.name, color: c.color }));
  const tasks = share.includeTasks ? (by.tasks ?? []).map(t => ({ ...t, linkedScheduleId: undefined, projectId: undefined })) : [];
  return json({ name: typeof share.name === 'string' ? share.name.slice(0, 20) : '', schedules, recurrenceRules: rules, recurrenceExceptions: exceptions, categories, tasks });
};
