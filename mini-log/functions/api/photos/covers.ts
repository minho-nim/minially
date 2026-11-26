import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { coverPhotos } from '../../_photos';

// GET /api/photos/covers?ids=원고id,원고id… → { covers: { 원고id: 첫 사진id } } (본인 원고만, 한 번에 30개까지)
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const raw = new URL(ctx.request.url).searchParams.get('ids') ?? '';
  const ids = raw ? raw.split(',') : [];
  if (ids.length > 30 || ids.some(id => !/^[0-9a-f-]{36}$/.test(id))) return json({ error: '원고 목록이 올바르지 않아요.' }, 400);
  return json({ covers: await coverPhotos(auth.db, auth.session.user, [...new Set(ids)]) });
};
