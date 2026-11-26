import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { listTagSets, readTagSet, saveTagSet } from '../../_tagSets';

// 해시태그 묶음 — GET: 목록(본인 것만) · POST { name, tags }: 저장(같은 이름이면 바꿈)
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json({ sets: await listTagSets(auth.db, auth.session.user) });
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const set = readTagSet(await readJson(ctx.request));
  if (typeof set === 'string') return json({ error: set }, 400);
  const error = await saveTagSet(auth.db, auth.session.user, set);
  if (error) return json({ error }, 400);
  return json({ sets: await listTagSets(auth.db, auth.session.user) });
};
