import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { deleteBundle, readBundle, saveBundle } from '../../../_structure';

const idOf = (ctx: HubContext) => (typeof ctx.params?.id === 'string' && /^[0-9a-f-]{36}$/.test(ctx.params.id) ? ctx.params.id : null);

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = idOf(ctx);
  if (!id) return json({ error: '묶음을 찾을 수 없어요.' }, 404);
  const bundle = readBundle(await readJson(ctx.request));
  if (typeof bundle === 'string') return json({ error: bundle }, 400);
  const saved = await saveBundle(auth.db, auth.session.user, id, bundle);
  if (saved === null) return json({ error: '묶음을 찾을 수 없어요.' }, 404);
  return typeof saved === 'string' ? json({ error: saved }, 400) : json({ bundle: saved });
};
export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = idOf(ctx);
  if (id) await deleteBundle(auth.db, auth.session.user, id);
  return json({ ok: true });
};
