import { json, readJson, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';
import { getStructure, getUiPrefs, isWritingStructure, setStructure, setUiPrefs, typeUsage } from '../../../shared/server/writing';

// 글쓰기·화면 설정(계정 기반) — GET: 글 구조·자주 쓴 글 종류·밑줄 끄기·첫 안내 다 봄 · PUT { structure?, marks_off?, steps_done? }: 저장(본인 것만, 값 검사)
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const [structure, types, ui] = await Promise.all([getStructure(auth.db, auth.session.user), typeUsage(auth.db, auth.session.user), getUiPrefs(auth.db, auth.session.user)]);
  return json({ structure, type_usage: types, ...ui });
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const body = await readJson(ctx.request);
  const ui: { marks_off?: boolean; steps_done?: boolean } = {};
  for (const k of ['marks_off', 'steps_done'] as const) {
    if (body?.[k] === undefined) continue;
    if (typeof body[k] !== 'boolean') return json({ error: '화면 설정 값이 올바르지 않아요.' }, 400);
    ui[k] = body[k];
  }
  if (body?.structure === undefined && !Object.keys(ui).length) return json({ error: '바꿀 설정이 없어요.' }, 400);
  if (body?.structure !== undefined && !isWritingStructure(body.structure)) return json({ error: '글 구조는 기본·홈피드형 중에서 골라 주세요.' }, 400);
  if (body?.structure !== undefined) await setStructure(auth.db, auth.session.user, body.structure);
  const saved = Object.keys(ui).length ? await setUiPrefs(auth.db, auth.session.user, ui) : await getUiPrefs(auth.db, auth.session.user);
  return json({ structure: await getStructure(auth.db, auth.session.user), ...saved });
};
