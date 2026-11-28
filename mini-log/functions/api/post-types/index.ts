import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { typeUsage } from '../../../../shared/server/writing';
import { cleanSettings, getTypeSettings, resolveTypes, saveTypeSettings } from '../../_typeSettings';

// GET → { types: [{key,label,outline,guide,custom,hidden}], manual: 순서를 정했는지, usage }  PUT { settings }: 본인 것만
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const [s, usage] = await Promise.all([getTypeSettings(auth.db, auth.session.user), typeUsage(auth.db, auth.session.user)]);
  return json({ types: resolveTypes(s), manual: !!s.order, usage, settings: s });
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const s = cleanSettings((await readJson(ctx.request))?.settings);
  if (typeof s === 'string') return json({ error: s }, 400);
  await saveTypeSettings(auth.db, auth.session.user, s);
  return json({ types: resolveTypes(s), manual: !!s.order, settings: s });
};
