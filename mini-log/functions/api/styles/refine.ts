import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { AiError, callGemini } from '../../../../shared/server/ai';
import { cleanChanges, cleanProfile, editedPairs, getMine, refinePrompt } from '../../_style';

// POST: '더 내 스타일로' — 승인·게시한 원고에서 AI 초안을 어떻게 고쳤는지 보고 내 문체 요약을 다듬은 안을 돌려준다.
// 저장하지 않는다. 사람이 바뀔 내용을 보고 '적용'을 누르면 PUT /api/styles/:id { profile }로 저장한다.
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const mine = await getMine(auth.db, auth.session.user);
  if (!mine.profile) return json({ error: '먼저 내 문체를 분석해 주세요.' }, 400);
  const pairs = await editedPairs(auth.db, auth.session.user);
  if (!pairs.length) return json({ error: 'AI 초안을 고쳐서 승인하거나 게시한 원고가 아직 없어요.' }, 400);
  let text: string;
  try {
    ({ text } = await callGemini({ env: ctx.env, db: auth.db, user: auth.session.user, app: 'minilog', task: 'style_refine', prompt: refinePrompt(mine.profile, pairs), json: true }));
  } catch (error) {
    if (error instanceof AiError) return json({ error: error.message, code: error.code }, error.status);
    throw error;
  }
  let raw: Record<string, unknown> | null = null;
  try { raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { raw = null; }
  const proposed = cleanProfile(raw);
  if (!proposed) return json({ error: 'AI 답을 읽지 못했어요. 다시 시도해 주세요.', code: 'bad_response' }, 502);
  return json({ style_id: mine.id, current: mine.profile, proposed, changes: cleanChanges(raw?.changes), used: pairs.length });
};
