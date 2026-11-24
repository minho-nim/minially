import {validateNoteDefaults} from '../../src/utils/noteFormatting';
import { validateNote, validateNoteFolder } from '../../src/utils/notes';
import type { Note, NoteFolder, NotePhoto } from '../../src/types';
import { validateNotePhoto } from '../../src/utils/notePhotos';
// 기기 동기화 서버(Cloudflare Pages Functions + D1).
// 코드 하나 = 데이터 공간 하나. 서버는 코드 원문을 모르고 SHA-256 해시만 비밀값(SYNC_CODE_HASHES)으로 가진다.
// 항목마다 마지막으로 올린 값이 이긴다. seq는 공간별로 올라가는 번호로, 기기는 마지막으로 받은 seq 이후만 받는다.

import { json, spaceFor, ensureSchema, blocked, recordFailure, tooManyResponse, type D1Database, type Context } from '../_lib';

const STORES = new Set(['schedules', 'presets', 'categories', 'recurrenceRules', 'recurrenceExceptions', 'tasks', 'appSettings', 'notes', 'noteFolders', 'notePhotos']);
const MAX_CHANGES = 5000;
const MAX_RECORD_BYTES = 256 * 1024;
const CHUNK = 200;

interface Change { store: string; id: string; data: unknown; baseSeq?: number }

function readChanges(body: unknown): Change[] | string {
  const changes = (body as { changes?: unknown })?.changes ?? [];
  if (!Array.isArray(changes)) return '변경 목록 형식이 아닙니다.';
  if (changes.length > MAX_CHANGES) return '한 번에 보낼 수 있는 변경이 너무 많습니다.';
  for (const c of changes) {
    if (!c || typeof c !== 'object') return '잘못된 변경입니다.';
    const { store, id } = c as Change;
    if (typeof store !== 'string' || !STORES.has(store)) return '알 수 없는 저장소입니다.';
    if (typeof id !== 'string' || !id || id.length > 200) return '잘못된 ID입니다.';
    if (c.baseSeq !== undefined && (!Number.isSafeInteger(c.baseSeq) || c.baseSeq < 0)) return '잘못된 메모 버전입니다.';
    if(store==='appSettings'&&c.data?.noteDefaults!==undefined){try{validateNoteDefaults(c.data.noteDefaults);}catch{return '메모 기본 서식이 올바르지 않습니다.';}}
    if ((store === 'notes' || store === 'noteFolders') && c.data !== null) {
      try {
        if (store === 'notes') validateNote(c.data as Note); else validateNoteFolder(c.data as NoteFolder);
        if ((c.data as {id:string}).id !== id) return '메모 ID가 일치하지 않습니다.';
      } catch { return '메모 데이터 형식이 올바르지 않습니다.'; }
    }
    if (store === 'notePhotos' && c.data !== null) {
      try { validateNotePhoto(c.data as NotePhoto); if ((c.data as NotePhoto).id !== id) return '사진 ID가 일치하지 않습니다.'; }
      catch { return '메모 사진 형식이 올바르지 않습니다.'; }
    }
  }
  return changes as Change[];
}

async function pull(db: D1Database, space: string, since: number) {
  const meta = await db.prepare('SELECT seq FROM sync_meta WHERE space = ?').bind(space).first<{ seq: number }>();
  const rows = await db
    .prepare('SELECT store, id, data, seq FROM sync_records WHERE space = ? AND seq > ? ORDER BY seq')
    .bind(space, since)
    .all<{ store: string; id: string; data: string | null; seq:number }>();
  return {
    seq: meta?.seq ?? 0,
    records: rows.results.map(r => ({ store: r.store, id: r.id, seq:r.seq, data: r.data === null ? null : JSON.parse(r.data) })),
  };
}

export const onRequest = async ({ request, env }: Context): Promise<Response> => {
  if (!env.DB || !env.SYNC_CODE_HASHES) return json({ error: '서버 동기화가 아직 설정되지 않았습니다.' }, 503);
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: '지원하지 않는 요청입니다.' }, 405);
  const db = env.DB;
  await ensureSchema(db);
  if (await blocked(db, request)) return tooManyResponse();
  const space = await spaceFor(request, env);
  if (!space) { await recordFailure(db, request); return json({ error: '코드가 맞지 않습니다.' }, 401); }

  const url = new URL(request.url);
  let since = Number(url.searchParams.get('since') ?? 0);

  if (request.method === 'POST') {
    let body: unknown;
    try { body = await request.json(); } catch { return json({ error: 'JSON 형식이 아닙니다.' }, 400); }
    const changes = readChanges(body);
    if (typeof changes === 'string') return json({ error: changes }, 400);
    since = Number((body as { since?: unknown }).since ?? since);
    if (!Number.isSafeInteger(since) || since < 0) since = 0;
    const now = Date.now();
    for (let i = 0; i < changes.length; i += CHUNK) {
      const statements = [
        db.prepare('INSERT INTO sync_meta (space, seq) VALUES (?, 1) ON CONFLICT(space) DO UPDATE SET seq = seq + 1').bind(space),
      ];
      for (const c of changes.slice(i, i + CHUNK)) {
        const data = c.data === null || c.data === undefined ? null : JSON.stringify(c.data);
        if (data && new TextEncoder().encode(data).length > MAX_RECORD_BYTES) return json({ error: '항목 하나가 너무 큽니다.' }, 413);
        // 같은 메모를 다른 기기가 먼저 고쳤으면, 한 트랜잭션 안에서 이전 버전을 사본으로 남긴다.
        // 구버전 기기는 since를 기준으로 비교하므로 기존 동기화 요청도 계속 사용할 수 있다.
        if (c.store === 'notes') {
          const copyId = crypto.randomUUID();
          statements.push(db.prepare(
            `INSERT INTO sync_records (space, store, id, data, seq, updated_at)
             SELECT space, store, ?, json_set(json_remove(data, '$.deletedAt'),
               '$.id', ?, '$.title', substr(coalesce(nullif(json_extract(data, '$.title'), ''), '제목 없는 메모'), 1, 460) || ' · 동기화 충돌 사본',
               '$.conflictOf', coalesce(json_extract(data, '$.conflictOf'), id), '$.conflictAt', ?, '$.createdAt', ?, '$.updatedAt', ?),
               (SELECT seq FROM sync_meta WHERE space = ?), ?
             FROM sync_records WHERE space = ? AND store = 'notes' AND id = ? AND data IS NOT NULL AND seq > ? AND data IS NOT ?`
          ).bind(copyId, copyId, now, now, now, space, now, space, c.id, c.baseSeq ?? since, data));
        }
        statements.push(
          db.prepare(
            'INSERT INTO sync_records (space, store, id, data, seq, updated_at) VALUES (?, ?, ?, ?, (SELECT seq FROM sync_meta WHERE space = ?), ?) ' +
              'ON CONFLICT(space, store, id) DO UPDATE SET data = excluded.data, seq = excluded.seq, updated_at = excluded.updated_at',
          ).bind(space, c.store, c.id, data, space, now),
        );
      }
      await db.batch(statements);
    }
  }

  if (!Number.isFinite(since) || since < 0) since = 0;
  return json(await pull(db, space, since));
};
