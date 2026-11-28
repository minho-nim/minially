import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { getCampaign, readCampaign, updateCampaign } from '../../_campaigns';
import { trashRow, TRASH_MS } from '../../_trash';
import { prepareDraft } from '../../_sponsorFlow';

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
  const before = await getCampaign(auth.db, auth.session.user, id);
  if (!before) return notFound();
  let campaign = await updateCampaign(auth.db, auth.session.user, id, patch);
  if (typeof campaign === 'string') return json({ error: campaign }, 400);
  if (!campaign) return notFound();
  // 선정되어 '진행 중'이 되면 가이드가 붙은 빈 원고를 마감 전날에 준비해 둔다(본문은 쓰지 않음)
  let prepared: { id: string; planned_on: string | null } | null = null;
  if (before.status !== 'in_progress' && campaign.status === 'in_progress') {
    prepared = await prepareDraft(auth.db, auth.session.user, campaign);
    if (prepared) campaign = (await getCampaign(auth.db, auth.session.user, id)) ?? campaign;
  }
  return json({ campaign, prepared_draft: prepared });
};

export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = idOf(ctx);
  if (!id || !(await getCampaign(auth.db, auth.session.user, id))) return notFound();
  await trashRow(auth.db, auth.session.user, 'campaign', id); // 10분 동안 되돌릴 수 있게 휴지통으로
  return json({ ok: true, undo_ms: TRASH_MS });
};
