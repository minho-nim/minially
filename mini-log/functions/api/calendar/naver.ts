import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { CalDavError, naverCalendars } from '../../../../shared/server/naverCaldav';
import { kstDay, naverRead, naverState } from '../../_extCal';

// 네이버 캘린더 겹쳐 보기(읽기만, CalDAV). 계정은 관리자가 Cloudflare 비밀값으로 넣고(NAVER_CAL_C·D 또는 메일용 NAVER_MAIL_C·D),
// 사람은 여기서 켜고 끄고 숨길 캘린더만 고른다. 비밀번호·전체 아이디는 돌려주지 않는다.
// GET → { available, connected, account?, calendars?: [{href, name, hidden}], events, error? }  PUT { enabled?, hidden? }  DELETE(끄기)
const maskId = (id: string) => `${id.slice(0, 2)}***@naver.com`;

export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const st = await naverState(ctx.env, auth.db, auth.session.user);
  if (!st.acc) return json({ available: false, connected: false, events: [] });
  const account = maskId(st.acc.id);
  if (!st.enabled) return json({ available: true, connected: false, account, events: [] });
  const r = await naverRead(ctx.env, auth.db, auth.session.user, kstDay(-31), kstDay(90));
  if (!r || 'error' in r) return json({ available: true, connected: true, account, calendars: [], events: [], error: r?.error ?? '네이버 캘린더를 읽지 못했어요.' });
  return json({ available: true, connected: true, account, calendars: r.calendars, events: r.events });
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const body = await readJson(ctx.request) as { enabled?: unknown; hidden?: unknown } | null;
  const st = await naverState(ctx.env, auth.db, auth.session.user);
  if (!st.acc) return json({ error: '네이버 계정이 아직 연결되지 않았어요. 관리자에게 네이버 애플리케이션 비밀번호를 넣어 달라고 해 주세요.' }, 400);
  let enabled = st.enabled, hidden = st.hidden;
  if (body?.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') return json({ error: '켜기/끄기 값이 올바르지 않아요.' }, 400);
    enabled = body.enabled;
  }
  if (body?.hidden !== undefined) {
    if (!Array.isArray(body.hidden) || body.hidden.length > 20 || !body.hidden.every(h => typeof h === 'string' && h.startsWith('/') && h.length <= 300)) return json({ error: '숨길 캘린더 목록이 올바르지 않아요.' }, 400);
    hidden = [...new Set(body.hidden as string[])];
  }
  // 처음 켤 때는 실제로 읽어 보고 저장한다(비밀번호가 틀리면 켜지 않음)
  if (enabled && !st.enabled) {
    try { await naverCalendars(ctx.env, st.acc); }
    catch (e) { return json({ error: e instanceof CalDavError ? e.message : '네이버 캘린더를 읽지 못했어요.' }, 400); }
  }
  await auth.db.prepare('INSERT INTO minilog_ncal (user, enabled, hidden, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user) DO UPDATE SET enabled = excluded.enabled, hidden = excluded.hidden, updated_at = excluded.updated_at')
    .bind(auth.session.user, enabled ? 1 : 0, JSON.stringify(hidden), Date.now()).run();
  return json({ ok: true });
};

export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  await auth.db.prepare('DELETE FROM minilog_ncal WHERE user = ?').bind(auth.session.user).run();
  return json({ ok: true });
};
