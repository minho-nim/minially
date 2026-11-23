import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { getStyle, readSamples, saveSamples } from '../../_style';

// GET: 내 문체(붙여 넣은 글 + 요약) · PUT: 글 저장 { samples: string[] }
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json(await getStyle(auth.db, auth.session.user));
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const samples = readSamples((await readJson(ctx.request))?.samples);
  if (typeof samples === 'string') return json({ error: samples }, 400);
  await saveSamples(auth.db, auth.session.user, samples);
  return json(await getStyle(auth.db, auth.session.user));
};
