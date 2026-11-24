import { json, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';
import { exportBackup, mergeBackup } from '../_backup';

// GET: 내 mini-log 백업(JSON) · POST: 백업 합치기(본문이 백업 JSON, 최대 20MB)
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json(await exportBackup(auth.db, auth.session.user));
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const size = Number(ctx.request.headers.get('content-length') ?? 0);
  if (size > 20 * 1024 * 1024) return json({ error: '백업 파일이 너무 커요(20MB까지).' }, 413);
  let data: unknown;
  try { data = await ctx.request.json(); } catch { return json({ error: '백업 파일 형식(JSON)이 아니에요.' }, 400); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: '백업 파일 형식이 아니에요.' }, 400);
  try { return json({ result: await mergeBackup(auth.db, auth.session.user, data as Record<string, unknown>) }); }
  catch (e) { return json({ error: e instanceof Error ? e.message : '백업을 불러오지 못했어요.' }, 400); }
};
