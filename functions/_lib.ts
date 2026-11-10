// Pages Functions 공통 도구(밑줄로 시작하는 파일은 주소로 노출되지 않음).
export interface D1Result<T> { results: T[] }
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}
export interface Env { DB?: D1Database; SYNC_CODE_HASHES?: string }
export interface Context { request: Request; env: Env }

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 대소문자·'-' 무시, 헷갈리는 글자 O→0, I·L→1 */
export function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

export function bearer(request: Request) {
  return normalizeCode((request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''));
}

/** 내 코드(보기·고치기)로 데이터 공간 찾기 */
export async function spaceFor(request: Request, env: Env) {
  const code = bearer(request);
  if (code.length < 12) return null;
  const hash = await sha256Hex(code);
  const allowed = (env.SYNC_CODE_HASHES ?? '').split(/[\s,]+/).map(h => h.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(hash) ? hash.slice(0, 16) : null;
}

let schemaReady = false;
export async function ensureSchema(db: D1Database) {
  if (schemaReady) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS sync_meta (space TEXT PRIMARY KEY, seq INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS sync_records (space TEXT NOT NULL, store TEXT NOT NULL, id TEXT NOT NULL, data TEXT, seq INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (space, store, id))'),
    db.prepare('CREATE INDEX IF NOT EXISTS sync_records_seq ON sync_records (space, seq)'),
    // 공유 코드(보기 전용): 공간마다 하나. 코드 원문 대신 해시만 저장.
    db.prepare('CREATE TABLE IF NOT EXISTS sync_shares (share_hash TEXT PRIMARY KEY, space TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)'),
    // 틀린 코드 시도 횟수(IP별, 10분 창)
    db.prepare('CREATE TABLE IF NOT EXISTS sync_attempts (ip TEXT PRIMARY KEY, window_start INTEGER NOT NULL, failures INTEGER NOT NULL)'),
  ]);
  schemaReady = true;
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** 추측할 수 없는 16글자 코드(80비트) */
export function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const raw = [...bytes].map(b => ALPHABET[b % 32]).join('');
  return raw.match(/.{4}/g)!.join('-');
}

// 코드 맞히기 막기: 같은 IP에서 10분 안에 20번 넘게 틀리면 그 10분이 끝날 때까지 막는다.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 20;
const clientIp = (request: Request) => request.headers.get('cf-connecting-ip') ?? 'local';

export async function blocked(db: D1Database, request: Request) {
  const row = await db.prepare('SELECT window_start, failures FROM sync_attempts WHERE ip = ?').bind(clientIp(request)).first<{ window_start: number; failures: number }>();
  return !!row && Date.now() - row.window_start < WINDOW_MS && row.failures >= MAX_FAILURES;
}

export async function recordFailure(db: D1Database, request: Request) {
  const now = Date.now();
  await db.prepare(
    'INSERT INTO sync_attempts (ip, window_start, failures) VALUES (?, ?, 1) ON CONFLICT(ip) DO UPDATE SET ' +
      'failures = CASE WHEN ? - window_start >= ? THEN 1 ELSE failures + 1 END, ' +
      'window_start = CASE WHEN ? - window_start >= ? THEN ? ELSE window_start END',
  ).bind(clientIp(request), now, now, WINDOW_MS, now, WINDOW_MS, now).run();
}

export const tooManyResponse = () => json({ error: '코드를 너무 많이 틀렸어요. 10분 뒤에 다시 시도해 주세요.' }, 429);
