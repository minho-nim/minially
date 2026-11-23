import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { createCampaign, listCampaigns, readCampaign } from '../../_campaigns';

// GET: 내 협찬·광고 캠페인 목록 · POST: 추가
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json({ campaigns: await listCampaigns(auth.db, auth.session.user) });
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const body = await readJson(ctx.request);
  if (!body) return json({ error: 'JSON 형식이 아닙니다.' }, 400);
  const patch = readCampaign(body);
  if (typeof patch === 'string') return json({ error: patch }, 400);
  const campaign = await createCampaign(auth.db, auth.session.user, patch);
  if (typeof campaign === 'string') return json({ error: campaign }, 400);
  return json({ campaign }, 201);
};
