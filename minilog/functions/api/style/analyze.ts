import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { AiError, callGemini } from '../../../../shared/server/ai';
import { analysisPrompt, cleanProfile, getStyle, saveProfile, STYLE_LIMITS } from '../../_style';

// POST: 저장된 글로 문체를 분석해 요약을 저장한다.
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const style = await getStyle(auth.db, auth.session.user);
  const total = style.samples.reduce((n, s) => n + s.length, 0);
  if (total < STYLE_LIMITS.minChars) return json({ error: `예전 글을 모두 합쳐 ${STYLE_LIMITS.minChars}자 이상 넣어 주세요.` }, 400);
  let text: string;
  try {
    ({ text } = await callGemini({ env: ctx.env, db: auth.db, user: auth.session.user, app: 'minilog', task: 'style', prompt: analysisPrompt(style.samples), json: true }));
  } catch (error) {
    if (error instanceof AiError) return json({ error: error.message, code: error.code }, error.status);
    throw error;
  }
  let profile;
  try { profile = cleanProfile(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''))); } catch { profile = null; }
  if (!profile) return json({ error: 'AI 답을 읽지 못했어요. 다시 시도해 주세요.', code: 'bad_response' }, 502);
  await saveProfile(auth.db, auth.session.user, profile);
  return json(await getStyle(auth.db, auth.session.user));
};
