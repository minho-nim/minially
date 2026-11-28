// 미니로그 캘린더에 겹쳐 보는 바깥 일정(구글 iCal·네이버 CalDAV, 읽기만). 일정은 저장하지 않고 볼 때마다 읽는다.
import type { D1Database, HubEnv } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';
import { cleanIcsUrl, expandIcs, fetchIcs, parseIcs } from '../../shared/server/googleIcs';
import { CalDavError, naverCalAccount, naverCalendars, naverEvents, type NaverCalendar } from '../../shared/server/naverCaldav';

export interface ExtEvent { day: string; title: string; start: string | null; end: string | null; location: string; calendar?: string }
export const kstDay = (days = 0, now = Date.now()) => new Date(now + 9 * 3600000 + days * 86400000).toISOString().slice(0, 10);

/** 구글: 저장한 비공개 주소로 기간 안 일정. 연결 안 했으면 null */
export async function googleEvents(env: HubEnv, db: D1Database, user: UserName, from: string, to: string): Promise<{ url: string; events: ExtEvent[] | null } | null> {
  const row = await db.prepare('SELECT url FROM minilog_gcal WHERE user = ?').bind(user).first<{ url: string }>();
  if (!row) return null;
  const url = cleanIcsUrl(row.url, env.GOOGLE_ICS_TEST_ORIGIN ?? '');
  const text = url ? await fetchIcs(url) : null;
  if (!text || !text.includes('BEGIN:VCALENDAR')) return { url: row.url, events: null };
  return { url: row.url, events: expandIcs(parseIcs(text, from), from, to).map(e => ({ day: e.day, title: e.title, start: e.start, end: e.end, location: e.location })) };
}

/** 네이버: 켜 둔 사람만. 숨긴 캘린더는 빼고 */
export async function naverState(env: HubEnv, db: D1Database, user: UserName) {
  const acc = naverCalAccount(env, user);
  const row = await db.prepare('SELECT enabled, hidden FROM minilog_ncal WHERE user = ?').bind(user).first<{ enabled: number; hidden: string | null }>();
  let hidden: string[] = [];
  try { const h = JSON.parse(row?.hidden ?? '[]'); if (Array.isArray(h)) hidden = h.filter((x): x is string => typeof x === 'string'); } catch { hidden = []; }
  return { acc, enabled: !!row?.enabled, hidden };
}

export async function naverRead(env: HubEnv, db: D1Database, user: UserName, from: string, to: string): Promise<{ calendars: (NaverCalendar & { hidden: boolean })[]; events: ExtEvent[] } | { error: string } | null> {
  const st = await naverState(env, db, user);
  if (!st.acc || !st.enabled) return null;
  try {
    const cals = await naverCalendars(env, st.acc);
    const shown = cals.filter(c => !st.hidden.includes(c.href));
    return { calendars: cals.map(c => ({ ...c, hidden: st.hidden.includes(c.href) })), events: await naverEvents(env, st.acc, shown, from, to) };
  } catch (e) { return { error: e instanceof CalDavError ? e.message : '네이버 캘린더를 읽지 못했어요.' }; }
}

/** 아침 브리핑용: 오늘 구글·네이버 일정(읽기 실패는 조용히 빼고) */
export async function todayExternal(env: HubEnv, db: D1Database, user: UserName, today: string): Promise<(ExtEvent & { source: 'google' | 'naver' })[]> {
  const [g, n] = await Promise.all([googleEvents(env, db, user, today, today).catch(() => null), naverRead(env, db, user, today, today).catch(() => null)]);
  const out: (ExtEvent & { source: 'google' | 'naver' })[] = [];
  for (const e of g?.events ?? []) if (e.day === today) out.push({ ...e, source: 'google' });
  if (n && 'events' in n) for (const e of n.events) if (e.day === today) out.push({ ...e, source: 'naver' });
  return out.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
}
