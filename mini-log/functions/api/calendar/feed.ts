import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { icsStatus, rotateToken, turnOff } from '../../_ics';

// 달력 구독 주소: GET 상태 · POST 새로 만들기(이전 주소 끊김, 원문은 이 응답에만) · DELETE 끄기
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json(await icsStatus(auth.db, auth.session.user));
};
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const token = await rotateToken(auth.db, auth.session.user);
  const origin = new URL(ctx.request.url).origin;
  return json({ on: true, url: `${origin}/ics/${token}.ics` }, 200, { 'cache-control': 'no-store' });
};
export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  await turnOff(auth.db, auth.session.user);
  return json({ on: false });
};
