import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { saveCategories } from '../../_structure';

// PUT { categories: [{ id, name, parent_id }] } : 나무 전체(순서는 배열 순서)
export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const result = await saveCategories(auth.db, auth.session.user, await readJson(ctx.request));
  return typeof result === 'string' ? json({ error: result }, 400) : json({ categories: result });
};
