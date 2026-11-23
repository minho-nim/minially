import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { AiError, callGemini } from '../../../../shared/server/ai';
import { getBlog, matchStats, STATS_PROMPT } from '../../_blog';
import { PHOTO_LIMITS, sniffImage, toBase64 } from '../../_photos';

// POST: 블로그 통계 화면 캡처(사진 바이트) → AI가 글별 숫자를 읽어 제목으로 맞춘 뒤 저장. 캡처는 저장하지 않는다.
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const bytes = new Uint8Array(await ctx.request.arrayBuffer());
  if (bytes.byteLength === 0) return json({ error: '캡처 사진을 올려 주세요.' }, 400);
  if (bytes.byteLength > PHOTO_LIMITS.bytes) return json({ error: '캡처는 5MB까지예요.' }, 413);
  const type = sniffImage(bytes);
  if (!type) return json({ error: 'JPG·PNG·WEBP 캡처만 읽을 수 있어요.' }, 415);
  const { posts } = await getBlog(auth.db, auth.session.user);
  if (posts.length === 0) return json({ error: '먼저 내 블로그 글을 가져와 주세요.' }, 400);
  let text: string;
  try {
    ({ text } = await callGemini({ env: ctx.env, db: auth.db, user: auth.session.user, app: 'minilog', task: 'blog_stats', prompt: STATS_PROMPT, images: [{ mimeType: type, data: toBase64(bytes) }], json: true }));
  } catch (error) {
    if (error instanceof AiError) return json({ error: error.message, code: error.code }, error.status);
    throw error;
  }
  let rows: { title: string }[] = [];
  try { const parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); rows = Array.isArray(parsed?.posts) ? parsed.posts.slice(0, 100) : []; } catch { rows = []; }
  if (rows.length === 0) return json({ error: '캡처에서 글 숫자를 읽지 못했어요. 통계 화면이 잘 보이게 다시 캡처해 주세요.' }, 422);
  const { matched, unmatched } = matchStats(posts, rows);
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  if (matched.length) {
    await auth.db.batch(matched.map(m => auth.db.prepare(
      'UPDATE minilog_posts SET views = COALESCE(?, views), likes = COALESCE(?, likes), comments = COALESCE(?, comments), stats_on = ? WHERE user = ? AND post_key = ?',
    ).bind(m.views, m.likes, m.comments, today, auth.session.user, m.post_key)));
  }
  return json({ matched, unmatched, ...(await getBlog(auth.db, auth.session.user)) });
};
