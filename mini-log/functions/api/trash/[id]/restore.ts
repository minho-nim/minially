import { json, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { getDraft } from '../../../_drafts';
import { restoreTrash } from '../../../_trash';

// POST /api/trash/[id]/restore: 10분 안에 지운 원고·사진 되돌리기(본인 것만)
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = typeof ctx.params?.id === 'string' && /^[0-9a-f-]{36}$/.test(ctx.params.id) ? ctx.params.id : null;
  if (!id) return json({ error: '되돌릴 것을 찾을 수 없어요.' }, 404);
  const done = await restoreTrash(auth.db, auth.session.user, id);
  if (done === 'expired') return json({ error: '지운 지 10분이 지나 되돌릴 수 없어요.' }, 410);
  if (done === 'missing') return json({ error: '되돌릴 것을 찾을 수 없어요.' }, 404);
  return json({ kind: done, ...(done === 'draft' ? { draft: await getDraft(auth.db, auth.session.user, id) } : {}) });
};
