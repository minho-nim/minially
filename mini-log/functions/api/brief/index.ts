import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { buildBrief } from '../../_brief';

// GET: 아침 브리핑(오늘 할 일·숫자). 첫 화면 카드와 휴대폰 알림(서비스 워커)이 읽는다. 본인 것만
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json(await buildBrief(auth.db, auth.session.user, Date.now(), ctx.env));
};
