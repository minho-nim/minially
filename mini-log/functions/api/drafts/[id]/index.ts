import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { getDraft, readPatch, saveConflictCopy, updateDraft } from '../../../_drafts';
import { purgeTrash, trashDraft } from '../../../_trash';
import { saveVersion } from '../../../_writing';

const idOf = (ctx: HubContext) => {
  const id = ctx.params?.id;
  return typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id) ? id : null;
};
const notFound = () => json({ error: '원고를 찾을 수 없어요.' }, 404);

export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = idOf(ctx);
  const draft = id && (await getDraft(auth.db, auth.session.user, id));
  return draft ? json({ draft }) : notFound();
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = idOf(ctx);
  if (!id) return notFound();
  const body = await readJson(ctx.request);
  if (!body) return json({ error: 'JSON 형식이 아닙니다.' }, 400);
  const patch = readPatch(body);
  if (typeof patch === 'string') return json({ error: patch }, 400);
  // 동시 수정 보호: 편집 화면이 마지막으로 받은 수정 시각(base_updated_at)보다 서버 원고가 새것이고, 글 내용이 서로 다르면
  // 덮어쓰지 않고 내 내용을 사본 원고로 남긴다(409 + 최신 원고·사본).
  const base = body.base_updated_at;
  if (typeof base === 'number' && Number.isFinite(base)) {
    const current = await getDraft(auth.db, auth.session.user, id);
    if (!current) return notFound();
    const textKeys = ['title', 'body', 'experience', 'hashtags'] as const;
    const changesText = textKeys.some(k => patch[k] !== undefined && JSON.stringify(patch[k]) !== JSON.stringify(current[k]));
    if (current.updated_at > base && changesText) {
      const copy = await saveConflictCopy(auth.db, auth.session.user, current, patch);
      return json({ error: '다른 기기에서 먼저 고친 원고예요. 이 기기에서 고친 내용은 사본 원고로 남겼어요.', code: 'conflict', draft: current, copy: { ...copy, photo_count: 0 } }, 409);
    }
  }
  const before = patch.status ? await getDraft(auth.db, auth.session.user, id) : null;
  const draft = await updateDraft(auth.db, auth.session.user, id, patch);
  if (typeof draft === 'string') return json({ error: draft }, 400);
  if (!draft) return notFound();
  // 판 기록: 글을 고치면 10분에 한 줄('고친 글'), 승인·게시로 바꾸면 그때 글을 '최종'으로
  const finished = (draft.status === 'approved' || draft.status === 'published') && before && before.status !== draft.status;
  if (finished) await saveVersion(auth.db, auth.session.user, id, 'final', draft.title, draft.body);
  else if (patch.body !== undefined || patch.title !== undefined) await saveVersion(auth.db, auth.session.user, id, 'edit', draft.title, draft.body);
  return json({ draft });
};

export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = idOf(ctx);
  if (!id) return notFound();
  // 바로 지우지 않고 10분 휴지통으로(그동안 '되돌리기' 가능, 지나면 사진 파일까지 지움)
  if (!(await trashDraft(auth.db, auth.session.user, id))) return notFound(); // 없거나 남의 원고
  await purgeTrash(auth.db, ctx.env.MINILOG_PHOTOS, auth.session.user);
  return json({ ok: true, undo_ms: 10 * 60 * 1000 });
};
