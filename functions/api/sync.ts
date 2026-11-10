// 기기 동기화 서버(Cloudflare Pages Functions + D1).
// 코드 하나 = 데이터 공간 하나. 서버는 코드 원문을 모르고 SHA-256 해시만 비밀값(SYNC_CODE_HASHES)으로 가진다.
// 항목마다 마지막으로 올린 값이 이긴다. seq는 공간별로 올라가는 번호로, 기기는 마지막으로 받은 seq 이후만 받는다.

interface D1Result<T> { results: T[] }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
}
interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}
interface Env { DB?: D1Database; SYNC_CODE_HASHES?: string }
interface Context { request: Request; env: Env }

const STORES = new Set(['schedules', 'presets', 'categories', 'recurrenceRules', 'recurrenceExceptions', 'tasks', 'appSettings']);
const MAX_CHANGES = 5000;
const MAX_RECORD_BYTES = 256 * 1024;
const CHUNK = 200;

let schemaReady = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

async function spaceFor(request: Request, env: Env) {
  const header = request.headers.get('authorization') ?? '';
  const code = normalizeCode(header.replace(/^Bearer\s+/i, ''));
  if (code.length < 12) return null;
  const hash = await sha256Hex(code);
  const allowed = (env.SYNC_CODE_HASHES ?? '').split(/[\s,]+/).map(h => h.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(hash) ? hash.slice(0, 16) : null;
}

async function ensureSchema(db: D1Database) {
  if (schemaReady) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS sync_meta (space TEXT PRIMARY KEY, seq INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS sync_records (space TEXT NOT NULL, store TEXT NOT NULL, id TEXT NOT NULL, data TEXT, seq INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (space, store, id))'),
    db.prepare('CREATE INDEX IF NOT EXISTS sync_records_seq ON sync_records (space, seq)'),
  ]);
  schemaReady = true;
}

interface Change { store: string; id: string; data: unknown }

function readChanges(body: unknown): Change[] | string {
  const changes = (body as { changes?: unknown })?.changes ?? [];
  if (!Array.isArray(changes)) return '변경 목록 형식이 아닙니다.';
  if (changes.length > MAX_CHANGES) return '한 번에 보낼 수 있는 변경이 너무 많습니다.';
  for (const c of changes) {
    if (!c || typeof c !== 'object') return '잘못된 변경입니다.';
    const { store, id } = c as Change;
    if (typeof store !== 'string' || !STORES.has(store)) return '알 수 없는 저장소입니다.';
    if (typeof id !== 'string' || !id || id.length > 200) return '잘못된 ID입니다.';
  }
  return changes as Change[];
}

async function pull(db: D1Database, space: string, since: number) {
  const meta = await db.prepare('SELECT seq FROM sync_meta WHERE space = ?').bind(space).first<{ seq: number }>();
  const rows = await db
    .prepare('SELECT store, id, data FROM sync_records WHERE space = ? AND seq > ? ORDER BY seq')
    .bind(space, since)
    .all<{ store: string; id: string; data: string | null }>();
  return {
    seq: meta?.seq ?? 0,
    records: rows.results.map(r => ({ store: r.store, id: r.id, data: r.data === null ? null : JSON.parse(r.data) })),
  };
}

export const onRequest = async ({ request, env }: Context): Promise<Response> => {
  if (!env.DB || !env.SYNC_CODE_HASHES) return json({ error: '서버 동기화가 아직 설정되지 않았습니다.' }, 503);
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: '지원하지 않는 요청입니다.' }, 405);
  const space = await spaceFor(request, env);
  if (!space) return json({ error: '코드가 맞지 않습니다.' }, 401);
  const db = env.DB;
  await ensureSchema(db);

  const url = new URL(request.url);
  let since = Number(url.searchParams.get('since') ?? 0);

  if (request.method === 'POST') {
    let body: unknown;
    try { body = await request.json(); } catch { return json({ error: 'JSON 형식이 아닙니다.' }, 400); }
    const changes = readChanges(body);
    if (typeof changes === 'string') return json({ error: changes }, 400);
    since = Number((body as { since?: unknown }).since ?? since);
    const now = Date.now();
    for (let i = 0; i < changes.length; i += CHUNK) {
      const statements = [
        db.prepare('INSERT INTO sync_meta (space, seq) VALUES (?, 1) ON CONFLICT(space) DO UPDATE SET seq = seq + 1').bind(space),
      ];
      for (const c of changes.slice(i, i + CHUNK)) {
        const data = c.data === null || c.data === undefined ? null : JSON.stringify(c.data);
        if (data && data.length > MAX_RECORD_BYTES) return json({ error: '항목 하나가 너무 큽니다.' }, 413);
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
