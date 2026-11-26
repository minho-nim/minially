import { json, readJson, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';
import { readReview, reviewState, saveReview } from '../_review';

// 게시 7일 뒤 돌아보기 — GET: 돌아볼 원고·최근 평가 · POST { draft_id, verdict, note }: 평가 저장(본인 원고만)
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json(await reviewState(auth.db, auth.session.user));
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const input = readReview(await readJson(ctx.request));
  if (typeof input === 'string') return json({ error: input }, 400);
  const error = await saveReview(auth.db, auth.session.user, input);
  if (error) return json({ error }, 400);
  return json(await reviewState(auth.db, auth.session.user));
};
