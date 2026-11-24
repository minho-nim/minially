import { json, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { AiError, callGemini } from '../../../../shared/server/ai';
import { profiles } from '../../../../shared/server/profile';
import { getBlog } from '../../_blog';
import { draftPrompt, getForm, proposalStats, readDraft } from '../../_proposal';

// POST: AI가 양식 초안을 써서 돌려준다(저장은 화면에서 확인 뒤)
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session: { user } } = auth;
  const [form, stats, blog, style, names] = await Promise.all([
    getForm(db, user), proposalStats(db, user), getBlog(db, user),
    db.prepare("SELECT profile FROM minilog_styles WHERE user = ? AND kind = 'mine'").bind(user).first<{ profile: string | null }>(),
    profiles(db),
  ]);
  const styleSummary = style?.profile ? String(JSON.parse(style.profile).summary ?? '') : '';
  let text: string;
  try {
    ({ text } = await callGemini({ env: ctx.env, db, user, app: 'minilog', task: 'proposal', prompt: draftPrompt(form, stats, blog.posts.slice(0, 10).map(p => p.title), styleSummary, names[user].name), json: true }));
  } catch (error) {
    if (error instanceof AiError) return json({ error: error.message, code: error.code }, error.status);
    throw error;
  }
  const draft = readDraft(text);
  if (!draft) return json({ error: 'AI 답을 읽지 못했어요. 다시 시도해 주세요.', code: 'bad_response' }, 502);
  return json({ draft });
};
