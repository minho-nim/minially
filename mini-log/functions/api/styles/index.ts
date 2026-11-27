import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { cleanText, createReference, editedPairs, listStyles, STYLE_LIMITS } from '../../_style';
import { editHabits } from '../../_writing';

// GET: 내 문체 + 참고 문체 목록 · POST: 참고 문체 추가 { name, source }
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  // refine_ready: '더 내 스타일로'에 쓸 수 있는 고친 원고 수(최대 5)
  // habits: 고친 원고에서 규칙으로 뽑은 버릇(자주 지운 표현·즐겨 쓰는 끝맺음). 내 문체 AI 초안에 저절로 들어간다
  const pairs = await editedPairs(auth.db, auth.session.user);
  return json({ styles: await listStyles(auth.db, auth.session.user), refine_ready: pairs.length, habits: editHabits(pairs) });
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const body = await readJson(ctx.request);
  const name = cleanText(body?.name, STYLE_LIMITS.name);
  if (!name) return json({ error: '참고할 블로그 이름을 적어 주세요.' }, 400);
  const style = await createReference(auth.db, auth.session.user, name, cleanText(body?.source, STYLE_LIMITS.source));
  if (typeof style === 'string') return json({ error: style }, 400);
  return json({ style }, 201);
};
