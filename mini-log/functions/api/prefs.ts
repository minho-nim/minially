import { json, readJson, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';
import { getStructure, isWritingStructure, setStructure, typeUsage } from '../../../shared/server/writing';

// 글쓰기 설정(계정 기반) — GET: 글 구조·자주 쓴 글 종류 · PUT { structure }: 글 구조 저장(본인 것만)
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const [structure, types] = await Promise.all([getStructure(auth.db, auth.session.user), typeUsage(auth.db, auth.session.user)]);
  return json({ structure, type_usage: types });
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const body = await readJson(ctx.request);
  if (!isWritingStructure(body?.structure)) return json({ error: '글 구조는 기본·홈피드형 중에서 골라 주세요.' }, 400);
  await setStructure(auth.db, auth.session.user, body.structure);
  return json({ structure: body.structure });
};
