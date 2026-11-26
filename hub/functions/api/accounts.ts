import { json, type HubContext } from '../../../shared/server/d1';
import { USERS, requireSession } from '../../../shared/server/auth';
import { accountSummary } from '../../../shared/server/accounts';

// 미니허브 계정: 두 사람의 연결 블로그·공개 SNS 아이디·연락 이메일(로그인한 사람만, 비밀번호·토큰 없음)
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'hub');
  if (auth instanceof Response) return auth;
  return json({ users: await Promise.all(USERS.map(u => accountSummary(auth.db, u))) });
};
