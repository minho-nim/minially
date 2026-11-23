import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { getDraft, PHOTO_KEEP_DAYS } from '../../../_drafts';
import { addPhoto, cleanName, listPhotos, PHOTO_LIMITS, sniffImage } from '../../../_photos';

// GET: 원고의 사진 목록 · POST: 사진 한 장 올리기(본문 = 파일 바이트, 머리글 x-file-name = 파일 이름)
// PUT: 순서 바꾸기 { order: [사진 id, …] } — 지금 사진과 같은 id 묶음이어야 한다
const draftIdOf = (ctx: HubContext) => (typeof ctx.params?.id === 'string' && /^[0-9a-f-]{36}$/.test(ctx.params.id) ? ctx.params.id : null);

export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = draftIdOf(ctx);
  if (!id || !(await getDraft(auth.db, auth.session.user, id))) return json({ error: '원고를 찾을 수 없어요.' }, 404);
  return json({ photos: await listPhotos(auth.db, auth.session.user, id), storage: !!ctx.env.MINILOG_PHOTOS });
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const bucket = ctx.env.MINILOG_PHOTOS;
  if (!bucket) return json({ error: '사진 저장소(R2)가 아직 연결되지 않았어요.' }, 503);
  const id = draftIdOf(ctx);
  const draft = id ? await getDraft(auth.db, auth.session.user, id) : null;
  if (!id || !draft) return json({ error: '원고를 찾을 수 없어요.' }, 404);
  const declared = Number(ctx.request.headers.get('content-length') ?? 0);
  if (declared > PHOTO_LIMITS.bytes) return json({ error: '사진 한 장은 5MB까지 올릴 수 있어요.' }, 413);
  const count = (await auth.db.prepare('SELECT COUNT(*) AS n FROM minilog_photos WHERE user = ? AND draft_id = ?').bind(auth.session.user, id).first<{ n: number }>())?.n ?? 0;
  if (count >= PHOTO_LIMITS.perDraft) return json({ error: `사진은 원고 하나에 ${PHOTO_LIMITS.perDraft}장까지예요.` }, 400);
  const bytes = new Uint8Array(await ctx.request.arrayBuffer());
  if (bytes.byteLength === 0) return json({ error: '빈 파일이에요.' }, 400);
  if (bytes.byteLength > PHOTO_LIMITS.bytes) return json({ error: '사진 한 장은 5MB까지 올릴 수 있어요.' }, 413);
  const type = sniffImage(bytes);
  if (!type) return json({ error: 'JPG·PNG·WEBP 사진만 올릴 수 있어요.' }, 415);
  // 이미 게시한 원고에 사진을 더하면 그 사진도 남은 보관 기간에 맞춰 지운다.
  const expiresAt = draft.status === 'published' && draft.published_at ? draft.published_at + PHOTO_KEEP_DAYS * 86400000 : null;
  const photo = await addPhoto(auth.db, bucket, auth.session.user, id, bytes, type, cleanName(ctx.request.headers.get('x-file-name')), expiresAt);
  const { r2_key: _hidden, ...rest } = photo;
  return json({ photo: rest }, 201);
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = draftIdOf(ctx);
  if (!id || !(await getDraft(auth.db, auth.session.user, id))) return json({ error: '원고를 찾을 수 없어요.' }, 404);
  const order = (await readJson(ctx.request))?.order;
  const current = await listPhotos(auth.db, auth.session.user, id);
  const same = Array.isArray(order) && order.length === current.length && new Set(order).size === order.length
    && order.every(x => typeof x === 'string' && current.some(p => p.id === x));
  if (!same) return json({ error: '사진 순서가 올바르지 않아요. 새로고침 후 다시 해 주세요.' }, 400);
  await auth.db.batch((order as string[]).map((photoId, position) =>
    auth.db.prepare('UPDATE minilog_photos SET position = ? WHERE user = ? AND draft_id = ? AND id = ?').bind(position, auth.session.user, id, photoId)));
  return json({ photos: await listPhotos(auth.db, auth.session.user, id) });
};
