// 구글 캘린더 가져오기(읽기만): 사람이 구글 캘린더 설정의 'iCal 형식의 비공개 주소'를 넣으면 서버가 그 주소만 읽어
// 다가오는 일정 후보를 돌려준다. 구글 로그인(OAuth)이 없어 7일 만료가 없다. 주소는 서버에 저장하지 않는다(기기에만).
// 일정은 앱에서 사람이 고른 것만 저장한다(사진으로 일정 넣기와 같은 고르기 화면).

export interface IcsRepeat { frequency: 'daily' | 'weekly' | 'monthly'; interval: number; weekdays?: number[]; label: string }
export interface IcsEvent { title: string; date: string; start: string | null; end: string | null; location: string; memo: string; source: string; uncertain: boolean; until?: string; repeat?: IcsRepeat; uid: string }

export const ICS_LIMITS = { bytes: 2_000_000, events: 150, daysAhead: 90, title: 60, location: 80 };

/** 구글 캘린더 iCal 주소만 받는다: https://calendar.google.com/calendar/ical/<캘린더>/(private-<키>|public)/basic.ics */
export function cleanIcsUrl(raw: unknown, testOrigin = ''): URL | null {
  if (typeof raw !== 'string' || raw.length > 600) return null;
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (testOrigin && url.origin === testOrigin && /\.ics$/.test(url.pathname)) return url;
  if (url.protocol !== 'https:' || url.hostname !== 'calendar.google.com' || url.port || url.username || url.password) return null;
  return /^\/calendar\/ical\/[^/]+\/(private-[0-9a-f]+|public)\/basic\.ics$/.test(url.pathname) ? url : null;
}

/** 크기 제한을 두고 읽는다(리디렉트는 따라가지 않음) */
export async function fetchIcs(url: URL): Promise<string | null> {
  const res = await fetch(url.toString(), { redirect: 'manual', headers: { accept: 'text/calendar' }, signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!res || !res.ok || !res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > ICS_LIMITS.bytes) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.length; }
  return new TextDecoder().decode(all);
}

const unescape = (s: string) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const DAY_NAME = '일월화수목금토';

/** 그 시간대의 벽시계 시각 → 한국 시간 Date(UTC 칸에 한국 시각을 담음) */
function toKst(y: number, mo: number, d: number, h: number, mi: number, zone: string | null, utc: boolean): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  if (utc) return new Date(guess + 9 * 3600000);
  if (!zone || zone === 'Asia/Seoul') return new Date(guess);
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess)).map(p => [p.type, p.value]));
    const asZone = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    return new Date(guess - (asZone - guess) + 9 * 3600000); // 그 시간대의 시차만큼 되돌린 뒤 한국 시간으로
  } catch { return new Date(guess); }
}

interface Prop { value: string; params: Record<string, string> }
function readTime(p: Prop | undefined): { date: string; time: string | null } | null {
  if (!p) return null;
  const m = p.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{2}(Z)?)?$/);
  if (!m) return null;
  if (!m[4] || p.params.VALUE === 'DATE') return { date: `${m[1]}-${m[2]}-${m[3]}`, time: null };
  const k = toKst(+m[1], +m[2], +m[3], +m[4], +m[5], p.params.TZID ?? null, !!m[6]);
  return { date: ymd(k), time: `${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}` };
}

function readRule(rule: string | undefined): IcsRepeat | undefined {
  if (!rule) return undefined;
  const r = Object.fromEntries(rule.split(';').map(x => x.split('=') as [string, string]));
  const interval = Math.max(1, Math.min(12, Number(r.INTERVAL) || 1));
  const every = interval === 2 ? '격주' : interval > 1 ? `${interval}주마다` : '매주';
  if (r.FREQ === 'DAILY') return { frequency: 'daily', interval, label: interval > 1 ? `${interval}일마다` : '매일' };
  if (r.FREQ === 'MONTHLY') return { frequency: 'monthly', interval, label: interval > 1 ? `${interval}달마다` : '매달' };
  if (r.FREQ === 'WEEKLY') {
    const weekdays = (r.BYDAY ?? '').split(',').map(d => DAYS.indexOf(d.replace(/^[+-]?\d+/, ''))).filter(d => d >= 0);
    return { frequency: 'weekly', interval, ...(weekdays.length ? { weekdays } : {}), label: `${every}${weekdays.length ? ` ${weekdays.map(d => DAY_NAME[d]).join('·')}` : ''}` };
  }
  return undefined; // 매년 등은 첫 날 하나로
}

/** iCal 글 → 다가오는 일정 후보(오늘부터 90일, 반복은 첫 날 + 반복 규칙). 취소된 일정·반복의 예외(RECURRENCE-ID)는 뺀다 */
export function parseIcs(text: string, today: string): IcsEvent[] {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const end = ymd(new Date(Date.parse(`${today}T00:00:00Z`) + ICS_LIMITS.daysAhead * 86400000));
  const out: IcsEvent[] = [];
  let cur: Record<string, Prop> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT' && cur) {
      const ev = cur; cur = null;
      if (ev['RECURRENCE-ID'] || /CANCELLED/i.test(ev.STATUS?.value ?? '')) continue;
      const s = readTime(ev.DTSTART);
      if (!s) continue;
      const e = readTime(ev.DTEND);
      const repeat = readRule(ev.RRULE?.value);
      // 반복이 아니면 오늘~90일 안만, 반복이면 시작이 90일 안이고 끝(UNTIL)이 지나지 않은 것만
      const until = ev.RRULE?.value.match(/UNTIL=(\d{4})(\d{2})(\d{2})/);
      if (repeat ? s.date > end || (until && `${until[1]}-${until[2]}-${until[3]}` < today) : s.date < today || s.date > end) continue;
      const allDayUntil = !s.time && e && !e.time ? ymd(new Date(Date.parse(`${e.date}T00:00:00Z`) - 86400000)) : undefined; // 하루 일정의 끝날은 다음 날로 적힌다
      out.push({
        uid: unescape(ev.UID?.value ?? '').slice(0, 200),
        title: unescape(ev.SUMMARY?.value ?? '').slice(0, ICS_LIMITS.title) || '(제목 없음)',
        date: s.date, start: s.time, end: s.time && e?.time && e.date === s.date ? e.time : null,
        location: unescape(ev.LOCATION?.value ?? '').slice(0, ICS_LIMITS.location), memo: '', source: '구글 캘린더', uncertain: false,
        ...(allDayUntil && allDayUntil > s.date ? { until: allDayUntil } : {}), ...(repeat ? { repeat } : {}),
      });
      continue;
    }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    const key = name.toUpperCase();
    if (!['UID', 'SUMMARY', 'DTSTART', 'DTEND', 'LOCATION', 'RRULE', 'STATUS', 'RECURRENCE-ID'].includes(key)) continue;
    cur[key] = { value: line.slice(i + 1), params: Object.fromEntries(params.map(p => { const j = p.indexOf('='); return [p.slice(0, j).toUpperCase(), p.slice(j + 1)]; })) };
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? '')).slice(0, ICS_LIMITS.events);
}

/** 반복 일정을 기간 안의 날짜마다 펼친다(달력에 겹쳐 보기용). 매일·매주(요일)·매달, 최대 400개 */
export function expandIcs(events: IcsEvent[], from: string, to: string): (IcsEvent & { day: string })[] {
  const out: (IcsEvent & { day: string })[] = [];
  const DAY = 86400000;
  for (const e of events) {
    if (!e.repeat) { if (e.date >= from && e.date <= to) out.push({ ...e, day: e.date }); continue; }
    const start = Date.parse(`${e.date}T00:00:00Z`);
    const step = e.repeat.interval;
    for (let t = Math.max(start, Date.parse(`${from}T00:00:00Z`) - 7 * DAY * step); t <= Date.parse(`${to}T00:00:00Z`) && out.length < 400; t += DAY) {
      const d = new Date(t), day = d.toISOString().slice(0, 10);
      if (day < e.date || day < from) continue;
      const days = Math.round((t - start) / DAY);
      const ok = e.repeat.frequency === 'daily' ? days % step === 0
        : e.repeat.frequency === 'weekly' ? Math.floor(days / 7) % step === 0 && (e.repeat.weekdays?.length ? e.repeat.weekdays.includes(d.getUTCDay()) : d.getUTCDay() === new Date(start).getUTCDay())
        : d.getUTCDate() === new Date(start).getUTCDate() && ((d.getUTCFullYear() - new Date(start).getUTCFullYear()) * 12 + d.getUTCMonth() - new Date(start).getUTCMonth()) % step === 0;
      if (ok) out.push({ ...e, day });
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || (a.start ?? '').localeCompare(b.start ?? '')).slice(0, 400);
}
