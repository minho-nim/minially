import { json, type HubContext } from '../../../shared/server/d1';
import { sessionFor } from '../../../shared/server/auth';
import { ensureHubSchema } from '../../../shared/server/schema';
import { geminiStatus } from '../../../shared/server/usage';

// 로그인 전이면 { user: null }(콘솔 오류 없이 로그인 화면으로)
export const onRequestGet = async ({ request, env }: HubContext) => {
  if (!env.DB) return json({ error: '서버 설정이 아직 끝나지 않았습니다(DB).' }, 503);
  await ensureHubSchema(env.DB);
  const session = await sessionFor(request, env.DB, 'minilog');
  return json(session ? { user: session.user, gemini: geminiStatus(env, session.user) } : { user: null });
};
