import { json, readJson, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';
import { HANDLE_PLATFORMS, accountSummary, isHandlePlatform, readHandle, setHandle } from '../../../shared/server/accounts';

// 내 계정: GET 내 블로그·SNS 아이디·연락 이메일 · PUT { platform, handle }(빈 값이면 지움). 다른 사람 것은 볼 수 없다.
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json(await accountSummary(auth.db, auth.session.user));
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const body = await readJson(ctx.request);
  if (!isHandlePlatform(body?.platform)) return json({ error: '지원하지 않는 곳이에요.' }, 400);
  const handle = readHandle(body.platform, body.handle);
  if (handle === null) return json({ error: `${HANDLE_PLATFORMS[body.platform].label} 아이디 형식이 올바르지 않아요.` }, 400);
  await setHandle(auth.db, auth.session.user, body.platform, handle);
  return json(await accountSummary(auth.db, auth.session.user));
};
