import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { addBlog, getBlog, parseBlogInput, removeBlog } from '../../_blog';

// GET: 연결한 블로그들·가져온 글 · POST: 블로그 연결 추가 { blog_id: 네이버 아이디·주소 또는 티스토리 주소 } · DELETE ?blog_id=: 연결 지우기(가져온 글도)

export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json(await getBlog(auth.db, auth.session.user));
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  // 네이버: 아이디 또는 blog.naver.com/아이디, 티스토리: 이름.tistory.com
  const blogId = parseBlogInput((await readJson(ctx.request))?.blog_id);
  if (!blogId) return json({ error: '네이버 블로그 아이디(blog.naver.com/ 뒤 부분)나 티스토리 주소(○○.tistory.com)를 적어 주세요.' }, 400);
  const result = await addBlog(auth.db, auth.session.user, blogId);
  if (typeof result === 'string') return json({ error: result }, 400);
  return json({ blog_id: blogId, ...(await getBlog(auth.db, auth.session.user)) });
};

export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const blogId = parseBlogInput(new URL(ctx.request.url).searchParams.get('blog_id'));
  if (!blogId) return json({ error: '블로그 아이디가 올바르지 않아요.' }, 400);
  await removeBlog(auth.db, auth.session.user, blogId);
  return json(await getBlog(auth.db, auth.session.user));
};
