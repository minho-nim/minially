import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { listMails } from '../../_mail';
import { accountInfo } from '../../_mailbox';
import { withSaved } from '../../_creds';

// GET: 받은 메일(최근 100통, 네이버·Gmail 한 메일함)·연결된 계정·마지막 받기·답장 기다리는 수. 계정 주소는 앞부분만 보여 준다
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json({ ...accountInfo(await withSaved(ctx.env, auth.db, auth.session.user), auth.session.user), ...(await listMails(auth.db, auth.session.user)) });
};
