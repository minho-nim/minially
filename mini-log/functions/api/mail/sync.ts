import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { listMails, syncMail } from '../../_mail';
import { accountInfo } from '../../_mailbox';
import { withSaved } from '../../_creds';

// POST: 지금 받기(내 메일만). 이미 받는 중이면 건너뛴다
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const result = await syncMail(auth.db, ctx.env, auth.session.user);
  if (result.skipped === 'no_account') return json({ error: '메일(네이버·Gmail)이 아직 연결되지 않았어요.' }, 409);
  return json({ ...result, ...accountInfo(await withSaved(ctx.env, auth.db, auth.session.user), auth.session.user), ...(await listMails(auth.db, auth.session.user)) });
};
