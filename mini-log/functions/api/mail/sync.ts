import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { listMails, syncMail } from '../../_mail';

// POST: 지금 받기(내 메일만). 이미 받는 중이면 건너뛴다
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const result = await syncMail(auth.db, ctx.env, auth.session.user);
  if (result.skipped === 'no_account') return json({ error: '네이버 메일이 아직 연결되지 않았어요.' }, 409);
  return json({ ...result, ...(await listMails(auth.db, auth.session.user)) });
};
