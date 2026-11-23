import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { parseBlogInput } from '../../_blog';
import { addWatch, listWatch, refreshWatch, removeWatch } from '../../_ideas';

// 참고 블로그(글감용): POST { blog_id } 추가 후 최근 제목 받기 · PUT 모두 새로 받기 · DELETE ?blog_id= 지우기
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const blogId = parseBlogInput((await readJson(ctx.request))?.blog_id);
  if (!blogId) return json({ error: '네이버 블로그 아이디·주소나 티스토리 주소(○○.tistory.com)를 적어 주세요.' }, 400);
  const added = await addWatch(auth.db, auth.session.user, blogId);
  if (typeof added === 'string') return json({ error: added }, 400);
  const errors = await refreshWatch(auth.db, ctx.env, auth.session.user);
  return json({ watch: await listWatch(auth.db, auth.session.user), errors });
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const errors = await refreshWatch(auth.db, ctx.env, auth.session.user);
  return json({ watch: await listWatch(auth.db, auth.session.user), errors });
};

export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const blogId = parseBlogInput(new URL(ctx.request.url).searchParams.get('blog_id'));
  if (!blogId) return json({ error: '블로그 아이디가 올바르지 않아요.' }, 400);
  await removeWatch(auth.db, auth.session.user, blogId);
  return json({ watch: await listWatch(auth.db, auth.session.user) });
};
