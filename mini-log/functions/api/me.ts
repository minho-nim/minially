import { json, type HubContext } from '../../../shared/server/d1';
import { renewCookie, sessionFor } from '../../../shared/server/auth';
import { ensureHubSchema } from '../../../shared/server/schema';
import { profiles } from '../../../shared/server/profile';
import { geminiStatus } from '../../../shared/server/usage';
import { getUiPrefs } from '../../../shared/server/writing';

// 로그인 전이면 { user: null }(콘솔 오류 없이 로그인 화면으로). 이름·테마는 hub 설정에서 바꾼 것. 쓰는 동안은 로그인 기간을 늘린다.
export const onRequestGet = async ({ request, env }: HubContext) => {
  if (!env.DB) return json({ error: '서버 설정이 아직 끝나지 않았습니다(DB).' }, 503);
  await ensureHubSchema(env.DB);
  const session = await sessionFor(request, env.DB, 'minilog');
  if (!session) return json({ user: null });
  const mine = (await profiles(env.DB))[session.user];
  const cookie = await renewCookie(request, env.DB);
  // 화면 설정(밑줄 끄기·첫 안내 다 봄)도 함께: 화면이 따로 읽지 않아 로그아웃과 겹친 요청이 401을 받지 않는다
  const ui = await getUiPrefs(env.DB, session.user);
  return json({ user: session.user, name: mine.name, theme: mine.theme, gemini: geminiStatus(env, session.user), ui }, 200, cookie ? { 'set-cookie': cookie } : {});
};
