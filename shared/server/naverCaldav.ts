// 네이버 캘린더 읽기(CalDAV, 읽기만): caldav.calendar.naver.com에 네이버 아이디 + 애플리케이션 비밀번호로 붙어
// 캘린더 목록과 기간 안 일정(iCal)을 읽는다. 쓰기(PUT·DELETE)는 하지 않는다.
// 계정은 Cloudflare 비밀값 NAVER_CAL_C·D(없으면 메일용 NAVER_MAIL_C·D와 같은 값을 씀) = "아이디@naver.com:애플리케이션 비밀번호".
// 시험에서는 NAVER_CALDAV_TEST_BASE(http://127.0.0.1:포트/caldav)로 가짜 서버에 붙는다.
import type { HubEnv } from './d1';
import type { UserName } from './auth';
import { expandIcs, parseIcs } from './googleIcs';

const BASE = 'https://caldav.calendar.naver.com';
export interface NaverAccount { id: string; password: string }
export interface NaverCalendar { href: string; name: string }
export class CalDavError extends Error {}

export function naverCalAccount(env: HubEnv, user: UserName): NaverAccount | null {
  const raw = env[`NAVER_CAL_${user}`] ?? env[`NAVER_MAIL_${user}`];
  if (typeof raw !== 'string') return null;
  const i = raw.indexOf(':');
  const id = raw.slice(0, i).trim().replace(/@naver\.com$/i, ''), password = raw.slice(i + 1);
  return i > 0 && /^[a-z0-9._-]{3,40}$/i.test(id) && password ? { id, password } : null;
}

const base = (env: HubEnv) => (typeof env.NAVER_CALDAV_TEST_BASE === 'string' && /^http:\/\/127\.0\.0\.1:\d+\/caldav$/.test(env.NAVER_CALDAV_TEST_BASE) ? env.NAVER_CALDAV_TEST_BASE : BASE);
const b64 = (s: string) => { let o = ''; for (const c of new TextEncoder().encode(s)) o += String.fromCharCode(c); return btoa(o); };
const unxml = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#13;/g, '\r').replace(/&amp;/g, '&');
/** 이름공간 접두어(d:, D:, cal: 등)와 상관없이 태그 안 글자 */
const tags = (xml: string, name: string) => [...xml.matchAll(new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, 'gi'))].map(m => m[1]);
const responses = (xml: string) => tags(xml, 'response');

async function dav(env: HubEnv, acc: NaverAccount, method: 'PROPFIND' | 'REPORT', path: string, body: string, depth: '0' | '1') {
  const root = base(env);
  const url = new URL(path, `${root}/`);
  // 네이버 캘린더 서버(또는 시험 서버) 밖으로는 보내지 않는다
  if (url.origin !== new URL(root).origin) throw new CalDavError('네이버 캘린더 주소가 아니에요.');
  const res = await fetch(url.toString(), { method, redirect: 'manual', headers: { authorization: `Basic ${b64(`${acc.id}:${acc.password}`)}`, depth, 'content-type': 'application/xml; charset=utf-8' }, body, signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!res) throw new CalDavError('네이버 캘린더가 답하지 않아요.');
  if (res.status === 401 || res.status === 403) throw new CalDavError('네이버 캘린더 로그인에 실패했어요. 네이버 애플리케이션 비밀번호를 확인해 주세요.');
  if (res.status !== 207 && !res.ok) throw new CalDavError('네이버 캘린더를 읽지 못했어요.');
  const text = await res.text();
  if (text.length > 3_000_000) throw new CalDavError('네이버 캘린더 답이 너무 커요.');
  return text;
}

/** 내 캘린더 목록(이름·주소). 공유 받은 캘린더도 목록에 있으면 같이 */
export async function naverCalendars(env: HubEnv, acc: NaverAccount): Promise<NaverCalendar[]> {
  // 표준 순서(루트 → 내 주소 → 캘린더 모음). 루트가 답하지 않으면 네이버의 알려진 내 주소(/principals/users/아이디/)로
  let principal = '';
  try {
    const p1 = await dav(env, acc, 'PROPFIND', `${base(env)}/`, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>', '0');
    principal = unxml(tags(tags(p1, 'current-user-principal')[0] ?? '', 'href')[0] ?? '').trim();
  } catch (e) { if (e instanceof CalDavError && /로그인/.test(e.message)) throw e; }
  if (!principal) principal = `/principals/users/${encodeURIComponent(acc.id)}/`;
  const p2 = await dav(env, acc, 'PROPFIND', principal, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>', '0');
  const home = unxml(tags(tags(p2, 'calendar-home-set')[0] ?? '', 'href')[0] ?? '').trim();
  if (!home) throw new CalDavError('네이버 캘린더 목록을 찾지 못했어요.');
  const p3 = await dav(env, acc, 'PROPFIND', home, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:displayname/><d:resourcetype/></d:prop></d:propfind>', '1');
  return responses(p3).filter(r => /<(?:[\w-]+:)?calendar\b/i.test(tags(r, 'resourcetype')[0] ?? ''))
    .map(r => ({ href: unxml(tags(r, 'href')[0] ?? '').trim(), name: unxml(tags(r, 'displayname')[0] ?? '').trim().slice(0, 40) || '캘린더' }))
    .filter(c => c.href).slice(0, 20);
}

// 서버에 묻는 범위는 한국 시간 하루 차이를 넉넉히 덮고(앞뒤 하루씩), 날짜 거르기는 expandIcs가 한다
const stamp = (day: string, add: number) => `${new Date(Date.parse(`${day}T00:00:00Z`) + add * 86400000).toISOString().slice(0, 10).replace(/-/g, '')}T000000Z`;
/** 고른 캘린더들의 기간 안 일정(읽기만). 반복은 날마다 펼친다 */
export async function naverEvents(env: HubEnv, acc: NaverAccount, cals: NaverCalendar[], from: string, to: string) {
  const out: { day: string; title: string; start: string | null; end: string | null; location: string; calendar: string }[] = [];
  for (const cal of cals.slice(0, 10)) {
    const xml = await dav(env, acc, 'REPORT', cal.href, `<?xml version="1.0"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${stamp(from, -1)}" end="${stamp(to, 2)}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`, '1');
    const ics = tags(xml, 'calendar-data').map(unxml).join('\r\n');
    for (const e of expandIcs(parseIcs(ics, from), from, to)) out.push({ day: e.day, title: e.title, start: e.start, end: e.end, location: e.location, calendar: cal.name });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || (a.start ?? '').localeCompare(b.start ?? '')).slice(0, 400);
}
