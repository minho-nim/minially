import { json, readJson, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';
import { cleanName, saveProfile, THEMES, type Profile, type Theme } from '../../../shared/server/profile';

// 내 설정 바꾸기: PUT { name?, theme? } — 본인 것만
export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'hub');
  if (auth instanceof Response) return auth;
  const body = await readJson(ctx.request);
  if (!body) return json({ error: 'JSON 형식이 아닙니다.' }, 400);
  const patch: Partial<Profile> = {};
  if (body.name !== undefined) {
    const name = cleanName(body.name);
    if (!name) return json({ error: '이름은 1~20자로 적어 주세요(< > 는 쓸 수 없어요).' }, 400);
    patch.name = name;
  }
  if (body.theme !== undefined) {
    if (!THEMES.includes(body.theme as Theme)) return json({ error: '화면 테마가 올바르지 않아요.' }, 400);
    patch.theme = body.theme as Theme;
  }
  return json({ profile: await saveProfile(auth.db, auth.session.user, patch) });
};
