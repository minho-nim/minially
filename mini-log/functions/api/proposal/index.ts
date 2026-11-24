import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { getForm, proposalStats, readForm, saveForm } from '../../_proposal';

// GET: 내 기본 양식 + 실제 숫자 · PUT: 양식 저장
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json({ form: await getForm(auth.db, auth.session.user), stats: await proposalStats(auth.db, auth.session.user) });
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const body = await readJson(ctx.request);
  if (!body) return json({ error: 'JSON 형식이 아닙니다.' }, 400);
  const { updated_at: _u, ...current } = await getForm(auth.db, auth.session.user);
  const form = readForm(body, current);
  if (typeof form === 'string') return json({ error: form }, 400);
  const updated_at = await saveForm(auth.db, auth.session.user, form);
  return json({ form: { ...form, updated_at } });
};
