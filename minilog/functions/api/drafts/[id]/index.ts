import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { deleteDraft, getDraft, readPatch, updateDraft } from '../../../_drafts';

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
  const draft = await updateDraft(auth.db, auth.session.user, id, patch);
  return draft ? json({ draft }) : notFound();
};

export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = idOf(ctx);
  if (!id) return notFound();
  await deleteDraft(auth.db, auth.session.user, id);
  return json({ ok: true });
};
