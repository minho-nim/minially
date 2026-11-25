import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { cleanNote, deletePhotos, getPhoto, setPhotoNote } from '../../_photos';

// 사진 파일 보기(본인 것만) · 메모 저장 · 지우기
const idOf = (ctx: HubContext) => (typeof ctx.params?.id === 'string' && /^[0-9a-f-]{36}$/.test(ctx.params.id) ? ctx.params.id : null);
const notFound = () => json({ error: '사진을 찾을 수 없어요.' }, 404);

export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = idOf(ctx);
  const photo = id ? await getPhoto(auth.db, auth.session.user, id) : null;
  if (!photo || !ctx.env.MINILOG_PHOTOS) return notFound();
  const object = await ctx.env.MINILOG_PHOTOS.get(photo.r2_key);
  if (!object) return notFound();
  return new Response(object.body, {
    headers: {
      'content-type': photo.content_type,
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.name)}`,
    },
  });
};

/** 사진 메모 저장 { note } */
export const onRequestPatch = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = idOf(ctx);
  const photo = id ? await getPhoto(auth.db, auth.session.user, id) : null;
  if (!photo || !id) return notFound();
  const note = cleanNote((await readJson(ctx.request))?.note);
  if (note === null) return json({ error: '메모는 글자로만 저장할 수 있어요.' }, 400);
  await setPhotoNote(auth.db, auth.session.user, id, note);
  return json({ note });
};

export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = idOf(ctx);
  const photo = id ? await getPhoto(auth.db, auth.session.user, id) : null;
  if (!photo) return notFound();
  await deletePhotos(auth.db, ctx.env.MINILOG_PHOTOS, [photo], auth.session.user);
  return json({ ok: true });
};
