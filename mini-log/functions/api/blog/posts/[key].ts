import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { setPostStats } from '../../../_blog';

// PUT: 글 하나의 조회수·공감·댓글 직접 적기
export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const key = typeof ctx.params?.key === 'string' ? decodeURIComponent(ctx.params.key).slice(0, 300) : '';
  const body = await readJson(ctx.request);
  if (!key || !body) return json({ error: '잘못된 요청이에요.' }, 400);
  const result = await setPostStats(auth.db, auth.session.user, key, body, new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10));
  if (typeof result === 'string') return json({ error: result }, 400);
  return result ? json({ ok: true }) : json({ error: '글을 찾을 수 없어요.' }, 404);
};
