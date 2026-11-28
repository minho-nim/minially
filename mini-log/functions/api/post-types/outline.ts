import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { callGemini } from '../../../../shared/server/ai';
import { aiFail } from '../../_draftContext';
import { outlinePromptFor, readOutlineAnswer } from '../../_typeSettings';

// POST { label } → { outline, guide }: 글 종류 이름으로 뼈대 초안(저장하지 않음, 사람이 고쳐서 저장)
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const label = String((await readJson(ctx.request))?.label ?? '').trim().slice(0, 20);
  if (!label) return json({ error: '글 종류 이름을 먼저 적어 주세요.' }, 400);
  try {
    const { text } = await callGemini({ env: ctx.env, db: auth.db, user: auth.session.user, app: 'minilog', task: 'type_outline', prompt: outlinePromptFor(label), json: true });
    const r = readOutlineAnswer(text);
    return r ? json(r) : json({ error: 'AI 답에서 뼈대를 읽지 못했어요. 다시 시도해 주세요.' }, 502);
  } catch (e) { return aiFail(e); }
};
