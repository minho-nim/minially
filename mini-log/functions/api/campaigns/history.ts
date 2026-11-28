import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { brandHistory } from '../../_sponsorFlow';

// GET ?brand=업체이름&except=지금고치는협찬id → { past: [...] }: 같은 업체와 했던 협찬(게시·정산까지 간 것) 최근 5개. 본인 기록만
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const q = new URL(ctx.request.url).searchParams;
  const brand = (q.get('brand') ?? '').trim().slice(0, 60);
  const except = q.get('except') ?? '';
  if (brand.length < 2) return json({ past: [] });
  return json({ past: await brandHistory(auth.db, auth.session.user, brand, /^[0-9a-f-]{36}$/.test(except) ? except : '') });
};
