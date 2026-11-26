import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { addSavedIdea, listSavedIdeas, readSavedIdea } from '../../../_savedIdeas';

// 담아 둔 글감 — GET: 목록(본인 것만, 최근 것부터) · POST { text, memo?, url? }: 하나 담기
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json({ saved: await listSavedIdeas(auth.db, auth.session.user) });
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const idea = readSavedIdea(await readJson(ctx.request));
  if (typeof idea === 'string') return json({ error: idea }, 400);
  const error = await addSavedIdea(auth.db, auth.session.user, idea);
  if (error) return json({ error }, 400);
  return json({ saved: await listSavedIdeas(auth.db, auth.session.user) });
};
