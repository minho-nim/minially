import { json, type HubContext } from '../../../shared/server/d1';
import { sessionFor } from '../../../shared/server/auth';
import { ensureHubSchema } from '../../../shared/server/schema';
import { geminiStatus, monthStart, userUsage } from '../../../shared/server/usage';

// 로그인한 사용자 본인의 정보만: Gemini 연결 여부와 이번 달 앱별 사용량.
// 로그인 전이면 오류 대신 { user: null }(첫 화면에서 콘솔 오류가 나지 않게).
export const onRequestGet = async ({ request, env }: HubContext) => {
  if (!env.DB) return json({ error: '서버 설정이 아직 끝나지 않았습니다(DB).' }, 503);
  await ensureHubSchema(env.DB);
  const session = await sessionFor(request, env.DB, 'hub');
  if (!session) return json({ user: null });
  const since = monthStart();
  return json({
    user: session.user,
    gemini: geminiStatus(env, session.user),
    usage: { since: new Date(since).toISOString(), apps: await userUsage(env.DB, session.user, since) },
  });
};
