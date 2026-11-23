import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { createDraft, listDrafts, readPatch } from '../../_drafts';
import { cleanupExpired } from '../../_photos';

// 목록을 열 때 게시 후 30일이 지난 사진을 먼저 정리한다(본인 것만).
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session } = auth;
  await cleanupExpired(db, ctx.env.MINILOG_PHOTOS, session.user);
  const drafts = await listDrafts(db, session.user);
  const counts = (await db.prepare('SELECT draft_id, COUNT(*) AS n FROM minilog_photos WHERE user = ? GROUP BY draft_id').bind(session.user).all<{ draft_id: string; n: number }>()).results;
  const byDraft = new Map(counts.map(c => [c.draft_id, c.n]));
  return json({ drafts: drafts.map(d => ({ ...d, photo_count: byDraft.get(d.id) ?? 0 })) });
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  // 캘린더에서 날짜를 골라 만들면 { planned_on: 'YYYY-MM-DD' }
  const body = (await readJson(ctx.request)) ?? {};
  const patch = readPatch({ planned_on: body.planned_on });
  if (typeof patch === 'string') return json({ error: patch }, 400);
  return json({ draft: { ...(await createDraft(auth.db, auth.session.user, patch.planned_on ?? null)), photo_count: 0 } }, 201);
};
