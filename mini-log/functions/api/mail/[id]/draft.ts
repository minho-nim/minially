import { json, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { AiError } from '../../../../../shared/server/ai';
import { draftReplies, getMail } from '../../../_mail';

// POST: 이 메일의 답장 초안을 AI로 다시 쓰기(보낸 메일은 안 됨)
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session: { user } } = auth;
  const mail = await getMail(db, user, String(ctx.params?.id ?? ""));
  if (!mail) return json({ error: '메일을 찾지 못했어요.' }, 404);
  if (mail.status === 'sent') return json({ error: '이미 보낸 메일이에요.' }, 409);
  try {
    if (!(await draftReplies(db, ctx.env, user, [mail]))) return json({ error: 'AI 답에서 초안을 읽지 못했어요. 다시 시도해 주세요.' }, 502);
  } catch (e) {
    if (e instanceof AiError) return json({ error: e.message, code: e.code }, e.status);
    throw e;
  }
  return json({ mail: await getMail(db, user, mail.id) });
};
