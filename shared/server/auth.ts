import { json, readJson, type D1Database, type HubContext, type HubEnv } from './d1';
import { ensureHubSchema } from './schema';

export type AppName = 'hub' | 'minilog';
export const USERS = ['C', 'D'] as const;
export type UserName = (typeof USERS)[number];

const SESSION_DAYS = 30;
const COOKIE = 'mh_session';
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 20;

export async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 두 비밀값이 같은지, 어디서 달라지든 같은 시간이 걸리게 비교한다(먼저 해시로 길이를 맞춘다) */
export async function secretEquals(given: string, expected: string) {
  const [a, b] = await Promise.all([sha256Hex(given), sha256Hex(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 미니어리와 같은 규칙: 대소문자·'-' 무시, 헷갈리는 글자 O→0, I·L→1 */
export function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

/** "C:<해시>,D:<해시>"를 읽는다. 알 수 없는 사용자 이름은 무시한다. */
export function parseUserHashes(value: string | undefined) {
  const map = new Map<string, UserName>();
  for (const part of (value ?? '').split(/[\s,]+/)) {
    const [name, hash] = part.split(':').map(s => s?.trim());
    if (!name || !hash) continue;
    const user = name.toUpperCase() as UserName;
    if ((USERS as readonly string[]).includes(user) && /^[0-9a-f]{64}$/i.test(hash)) map.set(hash.toLowerCase(), user);
  }
  return map;
}

export async function userForCode(code: string, env: HubEnv): Promise<UserName | null> {
  const normalized = normalizeCode(code);
  if (normalized.length < 12) return null;
  return parseUserHashes(env.USER_CODE_HASHES).get(await sha256Hex(normalized)) ?? null;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(request: Request, name: string) {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function cookieHeader(request: Request, token: string, maxAge: number) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

const clientIp = (request: Request) => request.headers.get('cf-connecting-ip') ?? 'local';

async function blocked(db: D1Database, request: Request) {
  const row = await db.prepare('SELECT window_start, failures FROM hub_attempts WHERE ip = ?').bind(clientIp(request)).first<{ window_start: number; failures: number }>();
  return !!row && Date.now() - row.window_start < WINDOW_MS && row.failures >= MAX_FAILURES;
}

async function recordFailure(db: D1Database, request: Request) {
  const now = Date.now();
  await db.prepare(
    'INSERT INTO hub_attempts (ip, window_start, failures) VALUES (?, ?, 1) ON CONFLICT(ip) DO UPDATE SET ' +
      'failures = CASE WHEN ? - window_start >= ? THEN 1 ELSE failures + 1 END, ' +
      'window_start = CASE WHEN ? - window_start >= ? THEN ? ELSE window_start END',
  ).bind(clientIp(request), now, now, WINDOW_MS, now, WINDOW_MS, now).run();
}

export interface Session { user: UserName; app: AppName }

/** 요청의 세션 쿠키를 확인한다. 만료됐거나 다른 앱의 세션이면 null. */
export async function sessionFor(request: Request, db: D1Database, app: AppName): Promise<Session | null> {
  const token = readCookie(request, COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await db.prepare('SELECT user, app, expires_at FROM hub_sessions WHERE token_hash = ?')
    .bind(await sha256Hex(token)).first<{ user: UserName; app: AppName; expires_at: number }>();
  if (!row || row.app !== app || row.expires_at <= Date.now()) return null;
  return { user: row.user, app: row.app };
}

/** 로그인 유지: 남은 기간이 SESSION_DAYS의 절반보다 짧으면 다시 SESSION_DAYS로 늘린 쿠키를 돌려준다(쓰는 동안은 로그아웃되지 않게). */
export async function renewCookie(request: Request, db: D1Database): Promise<string | null> {
  const token = readCookie(request, COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const hash = await sha256Hex(token);
  const row = await db.prepare('SELECT expires_at FROM hub_sessions WHERE token_hash = ?').bind(hash).first<{ expires_at: number }>();
  const now = Date.now();
  if (!row || row.expires_at <= now || row.expires_at - now > (SESSION_DAYS / 2) * 86400000) return null;
  await db.prepare('UPDATE hub_sessions SET expires_at = ? WHERE token_hash = ?').bind(now + SESSION_DAYS * 86400000, hash).run();
  return cookieHeader(request, token, SESSION_DAYS * 86400);
}

/** 상태를 바꾸는 요청(POST·PUT·DELETE)은 같은 사이트에서 온 것만 받는다(다른 사이트가 몰래 보내는 요청 막기). */
export function sameOrigin(request: Request) {
  if (request.method === 'GET' || request.method === 'HEAD') return true;
  const origin = request.headers.get('origin');
  if (!origin) return true; // 브라우저가 아닌 호출(서버 간)은 Origin이 없다. 세션 쿠키 없이는 어차피 막힌다.
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}
const crossSite = () => json({ error: '다른 사이트에서 보낸 요청은 받지 않습니다.' }, 403);

const notConfigured = () => json({ error: '서버 설정이 아직 끝나지 않았습니다(DB 또는 사용자 코드).' }, 503);

/** 로그인이 필요한 API 앞에 둔다. 통과하면 세션과 DB를, 아니면 오류 응답을 돌려준다. */
export async function requireSession(ctx: HubContext, app: AppName): Promise<{ session: Session; db: D1Database } | Response> {
  const db = ctx.env.DB;
  if (!db) return notConfigured();
  if (!sameOrigin(ctx.request)) return crossSite();
  await ensureHubSchema(db);
  const session = await sessionFor(ctx.request, db, app);
  return session ? { session, db } : json({ error: '로그인이 필요합니다.' }, 401);
}

/** POST /api/login {code} */
export function loginHandler(app: AppName) {
  return async ({ request, env }: HubContext) => {
    if (request.method !== 'POST') return json({ error: '지원하지 않는 요청입니다.' }, 405);
    const db = env.DB;
    if (!db || !env.USER_CODE_HASHES) return notConfigured();
    if (!sameOrigin(request)) return crossSite();
    await ensureHubSchema(db);
    if (await blocked(db, request)) return json({ error: '코드를 너무 많이 틀렸어요. 10분 뒤에 다시 시도해 주세요.' }, 429);
    const body = await readJson(request);
    const code = typeof body?.code === 'string' ? body.code.slice(0, 100) : '';
    const user = await userForCode(code, env);
    if (!user) {
      await recordFailure(db, request);
      return json({ error: '코드가 맞지 않습니다.' }, 401);
    }
    const token = randomToken();
    const now = Date.now();
    await db.batch([
      db.prepare('DELETE FROM hub_sessions WHERE expires_at <= ?').bind(now),
      db.prepare('INSERT INTO hub_sessions (token_hash, user, app, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
        .bind(await sha256Hex(token), user, app, now, now + SESSION_DAYS * 86400000),
    ]);
    return json({ user }, 200, { 'set-cookie': cookieHeader(request, token, SESSION_DAYS * 86400) });
  };
}

/** POST /api/logout — 서버 세션을 지우고 쿠키를 비운다. */
export function logoutHandler() {
  return async ({ request, env }: HubContext) => {
    if (request.method !== 'POST') return json({ error: '지원하지 않는 요청입니다.' }, 405);
    if (!sameOrigin(request)) return crossSite();
    const token = readCookie(request, COOKIE);
    if (env.DB && token && /^[0-9a-f]{64}$/.test(token)) {
      await ensureHubSchema(env.DB);
      await env.DB.prepare('DELETE FROM hub_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
    }
    return json({ ok: true }, 200, { 'set-cookie': cookieHeader(request, '', 0) });
  };
}
