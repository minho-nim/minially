import type { HubContext } from '../../../shared/server/d1';
import { ensureHubSchema } from '../../../shared/server/schema';
import { buildIcs, collectEvents, userForToken } from '../_ics';

// 달력 앱이 몇 시간마다 가져가는 구독 주소(로그인 없음, 주소의 비밀값으로 사람을 찾는다). 일정 제목만 담고 금액·메모는 넣지 않는다.
export const onRequestGet = async (ctx: HubContext) => {
  const db = ctx.env.DB;
  const raw = String(ctx.params?.token ?? '').replace(/\.ics$/, '');
  if (!db) return new Response('not configured', { status: 503 });
  await ensureHubSchema(db);
  const user = await userForToken(db, raw);
  if (!user) return new Response('not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const body = buildIcs(await collectEvents(db, user, today), new Date());
  return new Response(body, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'private, max-age=900', 'x-robots-tag': 'noindex' } });
};
