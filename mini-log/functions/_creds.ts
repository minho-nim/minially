// 화면에서 직접 연결한 메일·캘린더 계정(네이버·Gmail 앱 비밀번호).
// 비밀번호는 Cloudflare 비밀값 CRED_KEY(32바이트를 base64로)로 AES-GCM 암호화해 minilog_creds에 둔다.
// 사람·계정 이름을 추가 인증 자료(AAD)로 묶어, 다른 사람 줄로 옮겨 붙이면 풀리지 않는다. 비밀번호는 화면·API·로그로 다시 내보내지 않는다.
// 화면에서 넣은 계정이 Cloudflare 비밀값(NAVER_MAIL_C 등)보다 먼저 쓰이고, 연결을 끊으면 비밀값으로 돌아간다(소유자 결정 2026-11-28).
import type { D1Database, HubEnv } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';
import type { Provider } from './_mailbox';

const te = new TextEncoder(), td = new TextDecoder();
const toB64 = (u: Uint8Array) => { let s = ''; for (const b of u) s += String.fromCharCode(b); return btoa(s); };
const fromB64 = (s: string) => { try { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); } catch { return null; } };

async function key(env: HubEnv): Promise<CryptoKey | null> {
  const raw = typeof env.CRED_KEY === 'string' ? fromB64(env.CRED_KEY.trim()) : null;
  if (!raw || raw.length !== 32) return null;
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
/** 화면에서 연결을 저장할 수 있는지(CRED_KEY가 있는지) */
export const credReady = async (env: HubEnv) => !!(await key(env));

export async function seal(env: HubEnv, user: UserName, provider: Provider, text: string): Promise<string | null> {
  const k = await key(env); if (!k) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(`${user}:${provider}`) }, k, te.encode(text)));
  return `v1.${toB64(iv)}.${toB64(ct)}`;
}
export async function unseal(env: HubEnv, user: UserName, provider: Provider, sealed: string): Promise<string | null> {
  const k = await key(env); if (!k) return null;
  const [v, ivs, cts] = sealed.split('.');
  const iv = fromB64(ivs ?? ''), ct = fromB64(cts ?? '');
  if (v !== 'v1' || !iv || !ct) return null;
  try { return td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: te.encode(`${user}:${provider}`) }, k, ct)); } catch { return null; }
}

/** 화면에서 연결한 계정(풀리는 것만) */
export async function savedCreds(env: HubEnv, db: D1Database, user: UserName): Promise<Partial<Record<Provider, { login: string; password: string }>>> {
  const rows = (await db.prepare("SELECT provider, login, secret FROM minilog_creds WHERE user = ? AND provider IN ('naver', 'gmail')").bind(user).all<{ provider: Provider; login: string; secret: string }>()).results;
  const out: Partial<Record<Provider, { login: string; password: string }>> = {};
  for (const r of rows) { const password = await unseal(env, user, r.provider, r.secret); if (password) out[r.provider] = { login: r.login, password }; }
  return out;
}

/** 이 요청에서 쓸 env: 화면에서 연결한 계정을 비밀값 자리에 얹는다(네이버는 메일·캘린더 둘 다) */
export async function withSaved(env: HubEnv, db: D1Database, user: UserName): Promise<HubEnv> {
  const s = await savedCreds(env, db, user);
  if (!s.naver && !s.gmail) return env;
  const next: HubEnv = { ...env };
  if (s.naver) { next[`NAVER_MAIL_${user}`] = `${s.naver.login}:${s.naver.password}`; next[`NAVER_CAL_${user}`] = `${s.naver.login}:${s.naver.password}`; }
  if (s.gmail) next[`GMAIL_MAIL_${user}`] = `${s.gmail.login}:${s.gmail.password}`;
  return next;
}

export async function saveCred(env: HubEnv, db: D1Database, user: UserName, provider: Provider, login: string, password: string) {
  const secret = await seal(env, user, provider, password);
  if (!secret) return false;
  await db.prepare('INSERT INTO minilog_creds (user, provider, login, secret, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user, provider) DO UPDATE SET login = excluded.login, secret = excluded.secret, updated_at = excluded.updated_at')
    .bind(user, provider, login, secret, Date.now()).run();
  return true;
}
export const deleteCred = (db: D1Database, user: UserName, provider: Provider) => db.prepare('DELETE FROM minilog_creds WHERE user = ? AND provider = ?').bind(user, provider).run();

/** 주소 검사: 네이버는 아이디만 적어도 @naver.com을 붙인다. Gmail 앱 비밀번호의 빈칸은 지운다 */
export function readLogin(provider: Provider, login: unknown, password: unknown): { login: string; password: string } | string {
  let l = typeof login === 'string' ? login.trim().toLowerCase() : '';
  if (provider === 'naver' && /^[a-z0-9._-]{3,40}$/.test(l)) l += '@naver.com';
  const okLogin = provider === 'naver' ? /^[a-z0-9._-]{3,40}@naver\.com$/.test(l) : /^[^\s@:]{1,64}@[a-z0-9.-]+\.[a-z]{2,}$/.test(l) && l.length <= 120;
  if (!okLogin) return provider === 'naver' ? '네이버 아이디를 확인해 주세요(예: tomong 또는 tomong@naver.com).' : 'Gmail 주소를 확인해 주세요(예: tomong@gmail.com).';
  const pw = typeof password === 'string' ? (provider === 'gmail' ? password.replace(/\s+/g, '') : password.trim()) : '';
  if (pw.length < 4 || pw.length > 64 || /[\r\n:]/.test(pw)) return '앱 비밀번호를 확인해 주세요. 로그인 비밀번호가 아니라 따로 만든 앱 비밀번호예요.';
  return { login: l, password: pw };
}
