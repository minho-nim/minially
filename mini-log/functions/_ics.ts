// 휴대폰 달력 구독(ICS): 협찬 마감·방문일·게시 예정·다시 연락할 날을 하루 종일 일정으로, 전날 오전 9시 알림.
// 달력 앱은 로그인 쿠키를 보낼 수 없어서 주소에 비밀값을 넣는다. DB에는 그 해시만 둔다.
import type { D1Database } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';
import { sha256Hex } from '../../shared/server/auth';

export interface IcsEvent { uid: string; date: string; title: string; note?: string }

const randomToken = () => [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');

/** 새 구독 주소 비밀값을 만든다(이전 것은 바로 끊긴다). 원문은 이때 한 번만 돌려준다. */
export async function rotateToken(db: D1Database, user: UserName) {
  const token = randomToken();
  await db.prepare('INSERT INTO minilog_ics (user, token_hash, created_at) VALUES (?, ?, ?) ON CONFLICT(user) DO UPDATE SET token_hash = excluded.token_hash, created_at = excluded.created_at')
    .bind(user, await sha256Hex(token), Date.now()).run();
  return token;
}
export async function icsStatus(db: D1Database, user: UserName) {
  const row = await db.prepare('SELECT created_at FROM minilog_ics WHERE user = ?').bind(user).first<{ created_at: number }>();
  return row ? { on: true, created_at: row.created_at } : { on: false, created_at: null };
}
export async function turnOff(db: D1Database, user: UserName) {
  await db.prepare('DELETE FROM minilog_ics WHERE user = ?').bind(user).run();
}
export async function userForToken(db: D1Database, token: string): Promise<UserName | null> {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const row = await db.prepare('SELECT user FROM minilog_ics WHERE token_hash = ?').bind(await sha256Hex(token)).first<{ user: UserName }>();
  return row?.user ?? null;
}

const addDays = (date: string, n: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** 달력에 넣을 일(최근 30일 ~ 앞으로 1년) */
export async function collectEvents(db: D1Database, user: UserName, today: string): Promise<IcsEvent[]> {
  const from = addDays(today, -30), to = addDays(today, 365);
  const [camps, drafts] = await Promise.all([
    db.prepare("SELECT id, brand, title, deadline, status, guide, pitch, apply_by FROM minilog_campaigns WHERE user = ? AND kind = 'sponsor' AND status IN ('interested', 'applied', 'proposed', 'in_progress', 'posted')").bind(user)
      .all<{ id: string; brand: string; title: string; deadline: string | null; status: string; guide: string | null; pitch: string | null; apply_by: string | null }>(),
    db.prepare("SELECT id, title, planned_on FROM minilog_drafts WHERE user = ? AND status != 'published' AND planned_on IS NOT NULL").bind(user)
      .all<{ id: string; title: string; planned_on: string }>(),
  ]);
  const events: IcsEvent[] = [];
  for (const c of camps.results) {
    const name = `${c.brand}${c.title ? ` · ${c.title}` : ''}`;
    // 관심 담아 둔 공고는 신청 마감만(선정 전이라 리뷰 마감·방문일은 아직 없다)
    if (c.status === 'interested') { if (c.apply_by) events.push({ uid: `apply-${c.id}`, date: c.apply_by, title: `[신청 마감] ${name}` }); continue; }
    if (c.status === 'applied') continue;
    if (c.deadline) events.push({ uid: `deadline-${c.id}`, date: c.deadline, title: `[마감] ${name}` });
    try {
      const visit = c.guide ? (JSON.parse(c.guide) as { visit_on?: string }).visit_on : null;
      if (visit) events.push({ uid: `visit-${c.id}`, date: visit, title: `[방문] ${name}` });
      const pitch = c.pitch ? (JSON.parse(c.pitch) as { on?: string; reply?: string }) : null;
      if (pitch?.on && pitch.reply === 'waiting' && c.status === 'proposed') events.push({ uid: `follow-${c.id}`, date: addDays(pitch.on, 7), title: `[다시 연락] ${c.brand}`, note: '제안 뒤 7일째 답장이 없어요.' });
    } catch { /* 잘못 저장된 값은 건너뜀 */ }
  }
  for (const d of drafts.results) events.push({ uid: `post-${d.id}`, date: d.planned_on, title: `[게시 예정] ${d.title.trim() || '제목 없는 원고'}` });
  return events.filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date));
}

/** RFC 5545 글자 처리(\\ ; , 줄바꿈) */
const esc = (text: string) => text.replace(/[\;,]/g, m => `\\${m}`).replace(/\r?\n/g, '\\n');
/** 75바이트마다 줄 접기 */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = []; let cur = ''; let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; size = 0; }
    cur += ch; size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function buildIcs(events: IcsEvent[], stamp: Date) {
  const dt = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//minihub//mini-log//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:미니로그 일정', 'X-WR-TIMEZONE:Asia/Seoul', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
  ];
  for (const e of events) {
    const day = e.date.replace(/-/g, '');
    const next = addDays(e.date, 1).replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@minilog`, `DTSTAMP:${dt}`, `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next}`, `SUMMARY:${esc(e.title)}`);
    if (e.note) lines.push(`DESCRIPTION:${esc(e.note)}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT'); // 전날 오전 9시
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
