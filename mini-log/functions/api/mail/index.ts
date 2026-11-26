import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { listMails } from '../../_mail';
import { mailAccount } from '../../_mailbox';

// GET: 받은 메일(최근 100통)·연결 여부·마지막 받기·답장 기다리는 수. 계정 주소는 앞부분만 보여 준다
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const account = mailAccount(ctx.env, auth.session.user);
  const masked = account ? account.address.replace(/^(.{2})[^@]*/, '$1***') : '';
  return json({ connected: !!account, address: masked, ...(await listMails(auth.db, auth.session.user)) });
};
