// 아침 브리핑: 오늘 할 일(협찬 마감·신청 마감·답장할 메일·단계 확인·오늘 올릴 원고)을 급한 순으로 고르고,
// 휴대폰 알림(웹 푸시)으로 아침에 한 번 알린다. AI를 쓰지 않는다(규칙만).
// 알림에는 내용을 싣지 않는다(빈 푸시). 휴대폰의 서비스 워커가 로그인된 상태로 /api/brief를 읽어 제목만 보여 준다.
// VAPID 키는 Cloudflare 비밀값 VAPID_PUBLIC_KEY·VAPID_PRIVATE_KEY에만 둔다(설정 화면에서 기기 안에서 만들어 복사).
import type { D1Database, HubEnv } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';

export type BriefKind = 'deadline' | 'apply' | 'reply' | 'suggest' | 'post';
export interface BriefItem { kind: BriefKind; title: string; sub: string; target: string; rank: number }
export interface Brief { today: string; items: BriefItem[]; counts: { posted_week: number; receivable: number; waiting: number; suggest: number } }

const DAY = 86400000;
export const kstToday = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
const dday = (n: number) => (n < 0 ? `${-n}일 지남` : n === 0 ? '오늘' : `D-${n}`);
const cut = (s: string, n = 30) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** 오늘 할 일: 급한 순(지난 마감 → 오늘 → 3일 안 → 답장 → 단계 확인 → 오늘 올릴 원고). 화면은 앞 3개를 크게 보여 준다 */
export async function buildBrief(db: D1Database, user: UserName, now = Date.now()): Promise<Brief> {
  const today = kstToday(now);
  const items: BriefItem[] = [];
  const camps = (await db.prepare("SELECT id, brand, title, status, deadline, apply_by, amount, suggest FROM minilog_campaigns WHERE user = ? AND status NOT IN ('paid', 'cancelled') LIMIT 500")
    .bind(user).all<{ id: string; brand: string; title: string; status: string; deadline: string | null; apply_by: string | null; amount: number; suggest: string | null }>()).results;
  for (const c of camps) {
    const name = cut(c.brand || c.title || '협찬', 20);
    if (c.deadline && ['proposed', 'in_progress'].includes(c.status)) {
      const n = daysBetween(today, c.deadline);
      if (n <= 3) items.push({ kind: 'deadline', title: `${name} 게시 마감`, sub: dday(n), target: 'campaigns', rank: n < 0 ? 0 : 10 + n });
    }
    if (c.apply_by && c.status === 'interested') {
      const n = daysBetween(today, c.apply_by);
      if (n >= 0 && n <= 3) items.push({ kind: 'apply', title: `${name} 체험단 신청`, sub: `신청 마감 ${dday(n)}`, target: 'campaigns', rank: 12 + n });
    }
    if (c.suggest) {
      let reason = '';
      try { reason = String(JSON.parse(c.suggest).reason ?? ''); } catch { reason = ''; }
      items.push({ kind: 'suggest', title: `${name} 단계 확인`, sub: cut(reason || '메일을 보고 단계 이동을 제안했어요', 40), target: 'campaigns', rank: 40 });
    }
  }
  const mails = (await db.prepare("SELECT brand, from_name, from_addr, reply_options FROM minilog_mails WHERE user = ? AND needs_reply = 1 AND kind NOT IN ('other', 'outgoing') AND status IN ('new', 'drafted') ORDER BY received_at DESC LIMIT 20")
    .bind(user).all<{ brand: string; from_name: string; from_addr: string; reply_options: string | null }>()).results;
  for (const [i, m] of mails.entries()) {
    if (i >= 2) break; // 답장은 앞 두 곳만 따로, 나머지는 숫자로
    items.push({ kind: 'reply', title: `${cut(m.brand || m.from_name || m.from_addr, 20)} 답장 보내기`, sub: m.reply_options ? '답장 안 준비됨' : '답장 초안 쓰기', target: 'mail', rank: 30 + i });
  }
  const posts = (await db.prepare("SELECT title FROM minilog_drafts WHERE user = ? AND planned_on = ? AND status != 'published' LIMIT 5").bind(user, today).all<{ title: string }>()).results;
  for (const p of posts) items.push({ kind: 'post', title: `'${cut(p.title || '제목 없는 원고', 24)}' 올리기`, sub: '오늘 게시 예정', target: 'drafts', rank: 20 });
  items.sort((a, b) => a.rank - b.rank);

  const week = await db.prepare("SELECT COUNT(*) AS n FROM minilog_drafts WHERE user = ? AND status = 'published' AND published_at >= ?").bind(user, now - 7 * DAY).first<{ n: number }>();
  const receivable = camps.filter(c => ['in_progress', 'posted'].includes(c.status)).reduce((s, c) => s + (c.amount || 0), 0);
  return { today, items: items.slice(0, 10), counts: { posted_week: week?.n ?? 0, receivable, waiting: mails.length, suggest: camps.filter(c => c.suggest).length } };
}

/* ───────── 웹 푸시(빈 알림 + VAPID) ───────── */
// 푸시 서비스 주소는 브라우저 회사 것만 받는다(서버가 이 주소로 요청을 보내므로 아무 주소나 받지 않는다)
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/, /^android\.googleapis\.com$/];

export function cleanSubscription(v: unknown, env: HubEnv): { endpoint: string; p256dh: string; auth: string } | null {
  const s = (v ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof s.endpoint !== 'string' || s.endpoint.length > 1000) return null;
  let url: URL;
  try { url = new URL(s.endpoint); } catch { return null; }
  const testOrigin = typeof env.PUSH_TEST_ORIGIN === 'string' ? env.PUSH_TEST_ORIGIN : '';
  const ok = (url.protocol === 'https:' && !url.port && PUSH_HOSTS.some(h => h.test(url.hostname))) || (!!testOrigin && url.origin === testOrigin);
  const b64 = /^[A-Za-z0-9_-]+={0,2}$/;
  const p256dh = s.keys?.p256dh, auth = s.keys?.auth;
  if (!ok || typeof p256dh !== 'string' || typeof auth !== 'string' || !b64.test(p256dh) || !b64.test(auth) || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint: url.href, p256dh, auth };
}

const b64url = (bytes: Uint8Array) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));

export function vapidKeys(env: HubEnv): { pub: string; priv: string } | null {
  const pub = typeof env.VAPID_PUBLIC_KEY === 'string' ? env.VAPID_PUBLIC_KEY.trim() : '';
  const priv = typeof env.VAPID_PRIVATE_KEY === 'string' ? env.VAPID_PRIVATE_KEY.trim() : '';
  try { if (fromB64url(pub).length !== 65 || fromB64url(priv).length !== 32) return null; } catch { return null; }
  return { pub, priv };
}

/** VAPID 서명(JWT ES256). 푸시 서비스가 '우리 서버가 보낸 것'인지 확인하는 데 쓴다 */
async function vapidAuth(endpoint: string, keys: { pub: string; priv: string }) {
  const p = fromB64url(keys.pub);
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: keys.priv, x: b64url(p.slice(1, 33)), y: b64url(p.slice(33, 65)), ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://mini-log.pages.dev' })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`)));
  return `vapid t=${head}.${body}.${b64url(sig)}, k=${keys.pub}`;
}

/** 빈 푸시 한 번. 410·404면 그 구독은 끝난 것(지운다) */
export async function sendPush(endpoint: string, keys: { pub: string; priv: string }): Promise<'ok' | 'gone' | 'fail'> {
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { authorization: await vapidAuth(endpoint, keys), ttl: '3600', urgency: 'normal', 'content-length': '0' }, redirect: 'manual', signal: AbortSignal.timeout(10000) });
    await res.body?.cancel().catch(() => {});
    return res.status === 404 || res.status === 410 ? 'gone' : res.ok ? 'ok' : 'fail';
  } catch { return 'fail'; }
}

/** 아침 알림 보내기(예약 작업): 할 일이 있는 사람에게만, 하루 한 번(같은 날 다시 불러도 겹치지 않음) */
export async function morningPush(db: D1Database, env: HubEnv, users: readonly UserName[], now = Date.now()) {
  const keys = vapidKeys(env);
  if (!keys) return { skipped: 'no_keys' as const };
  const today = kstToday(now);
  const result: Record<string, { sent: number; gone: number; failed: number; items: number }> = {};
  for (const user of users) {
    const subs = (await db.prepare('SELECT endpoint FROM minilog_push WHERE user = ? AND (last_sent_on IS NULL OR last_sent_on != ?) LIMIT 10').bind(user, today).all<{ endpoint: string }>()).results;
    const r = { sent: 0, gone: 0, failed: 0, items: 0 };
    result[user] = r;
    if (!subs.length) continue;
    r.items = (await buildBrief(db, user, now)).items.length;
    if (!r.items) continue; // 할 일이 없으면 깨우지 않는다
    for (const s of subs) {
      const got = await sendPush(s.endpoint, keys);
      if (got === 'gone') { r.gone++; await db.prepare('DELETE FROM minilog_push WHERE user = ? AND endpoint = ?').bind(user, s.endpoint).run(); }
      else if (got === 'ok') { r.sent++; await db.prepare('UPDATE minilog_push SET last_sent_on = ? WHERE user = ? AND endpoint = ?').bind(today, user, s.endpoint).run(); }
      else r.failed++;
    }
  }
  return { result };
}
