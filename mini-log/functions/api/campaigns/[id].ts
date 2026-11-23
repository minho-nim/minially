import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { deleteCampaign, getCampaign, readCampaign, updateCampaign } from '../../_campaigns';

// PUT: 고치기 · DELETE: 지우기 (본인 것만)
const idOf = (ctx: HubContext) => (typeof ctx.params?.id === 'string' && /^[0-9a-f-]{36}$/.test(ctx.params.id) ? ctx.params.id : null);
const notFound = () => json({ error: '캠페인을 찾을 수 없어요.' }, 404);

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = idOf(ctx);
  if (!id) return notFound();
  const body = await readJson(ctx.request);
  if (!body) return json({ error: 'JSON 형식이 아닙니다.' }, 400);
  const patch = readCampaign(body);
  if (typeof patch === 'string') return json({ error: patch }, 400);
  const campaign = await updateCampaign(auth.db, auth.session.user, id, patch);
  if (typeof campaign === 'string') return json({ error: campaign }, 400);
  return campaign ? json({ campaign }) : notFound();
};

export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = idOf(ctx);
  if (!id || !(await getCampaign(auth.db, auth.session.user, id))) return notFound();
  await deleteCampaign(auth.db, auth.session.user, id);
  return json({ ok: true });
};
