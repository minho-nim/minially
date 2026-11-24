import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { readBundle, saveBundle } from '../../../_structure';

// POST { name, hub, members } : 주제 묶음 만들기
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const bundle = readBundle(await readJson(ctx.request));
  if (typeof bundle === 'string') return json({ error: bundle }, 400);
  const saved = await saveBundle(auth.db, auth.session.user, null, bundle);
  return typeof saved === 'string' ? json({ error: saved }, 400) : json({ bundle: saved });
};
