import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { AiError, LIGHT_MODEL, callGemini } from '../../../../../shared/server/ai';
import { getDraft, LIMITS } from '../../../_drafts';
import { listPhotos, photoNotesBlock } from '../../../_photos';
import { questionPrompt, readQuestions, ruleQuestions } from '../../../_questions';

// POST /api/drafts/:id/questions { experience, post_type } → { questions: [{q, why}], source: 'ai' | 'rule' }
// 초안 전에 빠진 사실을 묻는다. 가벼운 모델(사진 없이 글만)로 묻고, AI를 못 쓰면 규칙 질문으로 대신한다.
const QUESTION_MODEL = LIGHT_MODEL;

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = typeof ctx.params?.id === 'string' ? ctx.params.id : '';
  const draft = /^[0-9a-f-]{36}$/.test(id) ? await getDraft(auth.db, auth.session.user, id) : null;
  if (!draft) return json({ error: '원고를 찾을 수 없어요.' }, 404);
  const body = await readJson(ctx.request);
  const experience = typeof body?.experience === 'string' ? body.experience.trim() : draft.experience.trim();
  if (experience.length < 10) return json({ error: '실제 방문·사용 경험을 10자 이상 적어 주세요.' }, 400);
  if (experience.length > LIMITS.experience) return json({ error: '경험 글이 너무 길어요.' }, 400);
  const postType = typeof body?.post_type === 'string' ? body.post_type : draft.post_type;
  const notes = photoNotesBlock((await listPhotos(auth.db, auth.session.user, id)).map(p => p.note));
  try {
    const { text } = await callGemini({ env: ctx.env, db: auth.db, user: auth.session.user, app: 'minilog', task: 'draft_questions', prompt: questionPrompt(experience, draft.title, postType, notes), json: true, model: QUESTION_MODEL });
    let raw: unknown = null;
    try { raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { raw = null; }
    const questions = readQuestions(raw);
    if (raw !== null) return json({ questions, source: 'ai' });
  } catch (error) {
    if (!(error instanceof AiError)) throw error;
  }
  // AI 키가 없거나 한도·오류일 때: 규칙 질문(크레딧 없음)
  return json({ questions: ruleQuestions(experience), source: 'rule' });
};
