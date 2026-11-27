import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { listTagSets } from '../../_tagSets';
import { trashRow } from '../../_trash';

// 해시태그 묶음 하나 지우기(본인 것만)
export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = typeof ctx.params?.id === 'string' && /^[0-9a-f-]{36}$/.test(ctx.params.id) ? ctx.params.id : null;
  if (!id || !(await trashRow(auth.db, auth.session.user, 'tagset', id))) return json({ error: '묶음을 찾을 수 없어요.' }, 404); // 10분 동안 되돌릴 수 있게 휴지통으로
  return json({ sets: await listTagSets(auth.db, auth.session.user) });
};
