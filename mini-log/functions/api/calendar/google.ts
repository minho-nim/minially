import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { cleanIcsUrl, expandIcs, fetchIcs, parseIcs } from '../../../../shared/server/googleIcs';

// 구글 캘린더 겹쳐 보기(읽기만): 계정마다 'iCal 형식의 비공개 주소' 하나를 저장하고, 캘린더를 열 때마다 그 주소만 읽어
// 지난 31일 ~ 앞으로 90일 일정을 돌려준다. 일정은 저장하지 않는다. 주소는 화면에 가려서만 보여 주고 다시 돌려주지 않는다.
// GET → { connected, masked, events: [{day, title, start, end, location}] , error? }  PUT { url }  DELETE
const kst = (days = 0) => new Date(Date.now() + 9 * 3600000 + days * 86400000).toISOString().slice(0, 10);
const mask = (u: string) => { try { const p = new URL(u).pathname.split('/'); return `calendar.google.com/…/${decodeURIComponent(p[3] ?? '').replace(/^(.{3}).*(@.*)?$/, '$1***$2')}/…/basic.ics`; } catch { return '연결됨'; } };

export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const row = await auth.db.prepare('SELECT url FROM minilog_gcal WHERE user = ?').bind(auth.session.user).first<{ url: string }>();
  if (!row) return json({ connected: false, events: [] });
  const url = cleanIcsUrl(row.url, ctx.env.GOOGLE_ICS_TEST_ORIGIN ?? '');
  const text = url ? await fetchIcs(url) : null;
  if (!text || !text.includes('BEGIN:VCALENDAR')) return json({ connected: true, masked: mask(row.url), events: [], error: '구글 캘린더를 읽지 못했어요. 주소를 다시 만들었다면 새 주소로 다시 연결해 주세요.' });
  const from = kst(-31), to = kst(90);
  const events = expandIcs(parseIcs(text, from), from, to).map(e => ({ day: e.day, title: e.title, start: e.start, end: e.end, location: e.location }));
  return json({ connected: true, masked: mask(row.url), events });
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const body = await readJson(ctx.request);
  const url = cleanIcsUrl(body?.url, ctx.env.GOOGLE_ICS_TEST_ORIGIN ?? '');
  if (!url) return json({ error: "구글 캘린더 설정 → 캘린더 통합의 'iCal 형식의 비공개 주소'(calendar.google.com/…/basic.ics)를 붙여 넣어 주세요." }, 400);
  const text = await fetchIcs(url);
  if (!text || !text.includes('BEGIN:VCALENDAR')) return json({ error: '이 주소로 구글 캘린더를 읽지 못했어요. 주소를 다시 확인해 주세요.' }, 400);
  await auth.db.prepare('INSERT INTO minilog_gcal (user, url, updated_at) VALUES (?, ?, ?) ON CONFLICT(user) DO UPDATE SET url = excluded.url, updated_at = excluded.updated_at').bind(auth.session.user, url.href, Date.now()).run();
  return json({ ok: true });
};

export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  await auth.db.prepare('DELETE FROM minilog_gcal WHERE user = ?').bind(auth.session.user).run();
  return json({ ok: true });
};
