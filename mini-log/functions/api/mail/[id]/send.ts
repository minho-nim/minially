import { json, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { getMail, sendReply } from '../../../_mail';

// POST: 사람이 '보내기'를 눌렀을 때만 저장된 답장을 그 메일을 받은 내 계정(네이버·Gmail)으로 보낸다(자동 발송 없음)
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session: { user } } = auth;
  const id = String(ctx.params?.id ?? "");
  const sent = await sendReply(db, ctx.env, user, id);
  if (sent !== true) return json({ error: sent }, sent.includes('찾지') ? 404 : 409);
  return json({ mail: await getMail(db, user, id) });
};
