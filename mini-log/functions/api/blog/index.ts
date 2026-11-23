import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { addBlog, BLOG_ID, getBlog, removeBlog } from '../../_blog';

// GET: 연결한 블로그들·가져온 글 · POST: 블로그 연결 추가 { blog_id } · DELETE ?blog_id=: 연결 지우기(가져온 글도)
const readId = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/^https?:\/\/(m\.)?blog\.naver\.com\//i, '').split(/[/?#]/)[0] : '');

export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json(await getBlog(auth.db, auth.session.user));
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  // blog.naver.com/아이디 주소를 붙여 넣어도 아이디만 뽑는다
  const blogId = readId((await readJson(ctx.request))?.blog_id);
  if (!BLOG_ID.test(blogId)) return json({ error: '블로그 아이디는 영문·숫자·_·- 3~30자예요(blog.naver.com/ 뒤 부분).' }, 400);
  const result = await addBlog(auth.db, auth.session.user, blogId);
  if (typeof result === 'string') return json({ error: result }, 400);
  return json({ blog_id: blogId, ...(await getBlog(auth.db, auth.session.user)) });
};

export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const blogId = readId(new URL(ctx.request.url).searchParams.get('blog_id'));
  if (!BLOG_ID.test(blogId)) return json({ error: '블로그 아이디가 올바르지 않아요.' }, 400);
  await removeBlog(auth.db, auth.session.user, blogId);
  return json(await getBlog(auth.db, auth.session.user));
};
