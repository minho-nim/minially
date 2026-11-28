import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { getCampaign } from '../../../_campaigns';
import { sponsorMail } from '../../../_sponsorFlow';

// POST { kind: 'payment' | 'report' } → { to, subject, text }: 정산 확인·게시 결과 보고 메일 초안(규칙, AI 없음).
// 보내지 않는다. 화면이 '새 메일 쓰기'에 채워 주고 사람이 읽고 고친 뒤 직접 보낸다. 본인 협찬만.
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = typeof ctx.params?.id === 'string' && /^[0-9a-f-]{36}$/.test(ctx.params.id) ? ctx.params.id : null;
  const campaign = id ? await getCampaign(auth.db, auth.session.user, id) : null;
  if (!campaign) return json({ error: '캠페인을 찾을 수 없어요.' }, 404);
  const body = await readJson(ctx.request);
  const kind = body?.kind;
  if (kind !== 'payment' && kind !== 'report') return json({ error: '메일 종류가 올바르지 않아요.' }, 400);
  return json(await sponsorMail(auth.db, auth.session.user, campaign, kind));
};
