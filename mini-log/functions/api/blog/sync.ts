import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { getBlog, syncBlog } from '../../_blog';

// POST: 네이버 블로그 RSS로 내 글 가져오기
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const result = await syncBlog(auth.db, ctx.env, auth.session.user);
  if (typeof result === 'string') return json({ error: result }, 400);
  return json({ ...result, ...(await getBlog(auth.db, auth.session.user)) });
};
