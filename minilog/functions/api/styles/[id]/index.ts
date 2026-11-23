import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { cleanText, deleteReference, getStyle, readSamples, STYLE_LIMITS, updateStyle } from '../../../_style';

// PUT: 글·이름·출처 저장 · DELETE: 참고 문체 지우기(내 문체는 못 지움)
const idOf = (ctx: HubContext) => (typeof ctx.params?.id === 'string' && /^[0-9a-f-]{36}$/.test(ctx.params.id) ? ctx.params.id : null);
const notFound = () => json({ error: '문체를 찾을 수 없어요.' }, 404);

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = idOf(ctx);
  if (!id) return notFound();
  const body = await readJson(ctx.request);
  if (!body) return json({ error: 'JSON 형식이 아닙니다.' }, 400);
  const patch: { samples?: string[]; name?: string; source?: string } = {};
  if (body.samples !== undefined) {
    const samples = readSamples(body.samples);
    if (typeof samples === 'string') return json({ error: samples }, 400);
    patch.samples = samples;
  }
  if (body.name !== undefined) {
    patch.name = cleanText(body.name, STYLE_LIMITS.name);
    if (!patch.name) return json({ error: '이름을 비울 수 없어요.' }, 400);
  }
  if (body.source !== undefined) patch.source = cleanText(body.source, STYLE_LIMITS.source);
  const style = await updateStyle(auth.db, auth.session.user, id, patch);
  return style ? json({ style }) : notFound();
};

export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = idOf(ctx);
  const style = id ? await getStyle(auth.db, auth.session.user, id) : null;
  if (!style) return notFound();
  if (style.kind === 'mine') return json({ error: '내 문체는 지울 수 없어요. 글을 비워 주세요.' }, 400);
  await deleteReference(auth.db, auth.session.user, style.id);
  return json({ ok: true });
};
