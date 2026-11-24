import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { place } from '../../_structure';

// PUT { items: ['post:…' | 'draft:…'], category_id: string | null } : 글 배치(null이면 미분류)
export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const result = await place(auth.db, auth.session.user, await readJson(ctx.request));
  return result === true ? json({ ok: true }) : json({ error: result }, 400);
};
