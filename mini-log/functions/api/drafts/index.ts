import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { createDraft, listDrafts, readPatch, updateDraft } from '../../_drafts';
import { purgeTrash } from '../../_trash';
import { cleanupExpired } from '../../_photos';

// 목록을 열 때 게시 후 30일이 지난 사진을 먼저 정리한다(본인 것만).
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session } = auth;
  const beforeParam = new URL(ctx.request.url).searchParams.get('before');
  const cursor = beforeParam === null ? null : beforeParam.match(/^(\d{1,15})_([0-9a-f-]{36})$/);
  if (beforeParam !== null && !cursor) return json({ error: '목록 위치 값이 올바르지 않아요.' }, 400);
  if (!cursor) { await cleanupExpired(db, ctx.env.MINILOG_PHOTOS, session.user); await purgeTrash(db, ctx.env.MINILOG_PHOTOS, session.user); }
  const { drafts, more, next_before } = await listDrafts(db, session.user, cursor ? { at: Number(cursor[1]), id: cursor[2] } : null);
  const counts = (await db.prepare('SELECT draft_id, COUNT(*) AS n FROM minilog_photos WHERE user = ? GROUP BY draft_id').bind(session.user).all<{ draft_id: string; n: number }>()).results;
  const byDraft = new Map(counts.map(c => [c.draft_id, c.n]));
  return json({ drafts: drafts.map(d => ({ ...d, photo_count: byDraft.get(d.id) ?? 0 })), more, next_before });
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  // 캘린더에서 날짜를 골라 만들면 { planned_on: 'YYYY-MM-DD' }, 글감에서 만들면 제목·해시태그도 함께(경험 칸은 사용자가 직접 씀)
  const body = (await readJson(ctx.request)) ?? {};
  const patch = readPatch({ planned_on: body.planned_on, title: body.title, hashtags: body.hashtags });
  if (typeof patch === 'string') return json({ error: patch }, 400);
  const { planned_on, ...rest } = patch;
  let draft = await createDraft(auth.db, auth.session.user, planned_on ?? null);
  if (Object.keys(rest).length) {
    const updated = await updateDraft(auth.db, auth.session.user, draft.id, rest);
    if (updated && typeof updated !== 'string') draft = updated;
  }
  return json({ draft: { ...draft, photo_count: 0 } }, 201);
};
