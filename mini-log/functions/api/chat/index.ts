import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { AiError, callGemini } from '../../../../shared/server/ai';
import { profiles } from '../../../../shared/server/profile';
import { addChat, CHAT_LIMITS, chatPrompt, clearChat, listChat } from '../../_chat';

// GET: 내 대화 · POST { message, draft_id? }: 묻기 · DELETE: 대화 지우기
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json({ messages: await listChat(auth.db, auth.session.user) });
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session: { user } } = auth;
  const body = await readJson(ctx.request);
  const message = typeof body?.message === 'string' ? body.message.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim() : '';
  if (!message) return json({ error: '물어볼 내용을 적어 주세요.' }, 400);
  if (message.length > CHAT_LIMITS.message) return json({ error: `질문은 ${CHAT_LIMITS.message.toLocaleString('ko-KR')}자까지예요.` }, 400);
  const draftId = typeof body?.draft_id === 'string' && /^[0-9a-f-]{36}$/.test(body.draft_id) ? body.draft_id : null;
  const prompt = await chatPrompt(db, user, (await profiles(db))[user].name, message, draftId);
  let text: string;
  try {
    ({ text } = await callGemini({ env: ctx.env, db, user, app: 'minilog', task: 'chat', prompt }));
  } catch (error) {
    if (error instanceof AiError) return json({ error: error.message, code: error.code }, error.status);
    throw error;
  }
  const reply = text.trim().slice(0, 6000);
  if (!reply) return json({ error: 'AI 답이 비어 있어요. 다시 물어봐 주세요.', code: 'bad_response' }, 502);
  await addChat(db, user, 'user', message, draftId);
  await addChat(db, user, 'model', reply, draftId);
  return json({ messages: await listChat(db, user) });
};

export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  await clearChat(auth.db, auth.session.user);
  return json({ messages: [] });
};
