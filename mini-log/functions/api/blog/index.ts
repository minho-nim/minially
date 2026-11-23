import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { BLOG_ID, getBlog, setBlogId } from '../../_blog';

// GET: 내 블로그 아이디·가져온 글 · PUT: 블로그 아이디 저장 { blog_id }
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json(await getBlog(auth.db, auth.session.user));
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const raw = (await readJson(ctx.request))?.blog_id;
  // blog.naver.com/아이디 주소를 붙여 넣어도 아이디만 뽑는다
  const blogId = typeof raw === 'string' ? raw.trim().replace(/^https?:\/\/(m\.)?blog\.naver\.com\//i, '').split(/[/?#]/)[0] : '';
  if (!BLOG_ID.test(blogId)) return json({ error: '블로그 아이디는 영문·숫자·_·- 3~30자예요(blog.naver.com/ 뒤 부분).' }, 400);
  await setBlogId(auth.db, auth.session.user, blogId);
  return json(await getBlog(auth.db, auth.session.user));
};
