import { json, type HubContext } from '../../../shared/server/d1';
import { renewCookie, sessionFor } from '../../../shared/server/auth';
import { ensureHubSchema } from '../../../shared/server/schema';
import { profiles } from '../../../shared/server/profile';
import { geminiStatus, monthStart, userUsage } from '../../../shared/server/usage';

// 로그인한 사용자 본인의 정보: Gemini 연결 여부, 이번 달 앱별 사용량, 이름·테마(두 사람 이름도 함께: 통합 화면 표시용).
// 로그인 전이면 오류 대신 { user: null }(첫 화면에서 콘솔 오류가 나지 않게). 쓰는 동안은 로그인 기간을 늘린다.
export const onRequestGet = async ({ request, env }: HubContext) => {
  if (!env.DB) return json({ error: '서버 설정이 아직 끝나지 않았습니다(DB).' }, 503);
  await ensureHubSchema(env.DB);
  const session = await sessionFor(request, env.DB, 'hub');
  if (!session) return json({ user: null });
  const since = monthStart();
  const all = await profiles(env.DB);
  const cookie = await renewCookie(request, env.DB);
  return json({
    user: session.user,
    name: all[session.user].name,
    theme: all[session.user].theme,
    names: Object.fromEntries(Object.entries(all).map(([u, p]) => [u, p.name])),
    gemini: geminiStatus(env, session.user),
    usage: { since: new Date(since).toISOString(), apps: await userUsage(env.DB, session.user, since) },
  }, 200, cookie ? { 'set-cookie': cookie } : {});
};
