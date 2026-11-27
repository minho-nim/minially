import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { callGemini } from '../../../../../shared/server/ai';
import { aiFail, ownDraft } from '../../../_draftContext';
import { styleBlock, styleForDraft } from '../../../_style';
import { isRewriteMode, parseJson, readRewrite, REWRITE_LIMITS, rewritePrompt } from '../../../_writing';

// POST /api/drafts/:id/rewrite { part, before, after, mode } → { text }
// 본문에서 고른 부분만 다시 쓴다. 바꾼 글은 저장하지 않고 돌려주기만 하고, 화면에서 사람이 '적용'을 눌러야 본문에 들어간다.
export const onRequestPost = async (ctx: HubContext) => {
  const own = await ownDraft(ctx);
  if (own instanceof Response) return own;
  const body = await readJson(ctx.request);
  const part = typeof body?.part === 'string' ? body.part : '';
  if (part.trim().length < 2) return json({ error: '다시 쓸 부분을 본문에서 골라 주세요.' }, 400);
  if (part.length > REWRITE_LIMITS.part) return json({ error: `한 번에 ${REWRITE_LIMITS.part.toLocaleString('ko-KR')}자까지 고를 수 있어요.` }, 400);
  if (!isRewriteMode(body?.mode)) return json({ error: '어떻게 다시 쓸지 골라 주세요.' }, 400);
  const before = typeof body?.before === 'string' ? body.before.slice(-REWRITE_LIMITS.context) : '';
  const after = typeof body?.after === 'string' ? body.after.slice(0, REWRITE_LIMITS.context) : '';
  const style = body.mode === 'mine' ? styleBlock(await styleForDraft(own.db, own.user, 'mine')) : '';
  try {
    const { text } = await callGemini({ env: ctx.env, db: own.db, user: own.user, app: 'minilog', task: 'rewrite_part', json: true,
      prompt: rewritePrompt(body.mode, part, before, after, own.draft.experience.slice(0, 2000), style) });
    const out = readRewrite(parseJson(text), part);
    if (!out) return json({ error: 'AI가 고친 글이 [사진]·[작성자 확인 필요] 표시를 빼먹었거나 비어 있어요. 다시 시도해 주세요.', code: 'bad_response' }, 502);
    return json({ text: out });
  } catch (error) { return aiFail(error); }
};
