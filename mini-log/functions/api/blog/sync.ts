import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { getBlog, syncBlogs } from '../../_blog';

// POST: 네이버 블로그 RSS로 글 가져오기. { blog_id } 가 있으면 그 블로그만, 없으면 연결한 블로그 전부.
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const only = (await readJson(ctx.request))?.blog_id;
  const result = await syncBlogs(auth.db, ctx.env, auth.session.user, typeof only === 'string' && only ? only : undefined);
  if (typeof result === 'string') return json({ error: result }, 400);
  return json({ ...result, ...(await getBlog(auth.db, auth.session.user)) });
};
