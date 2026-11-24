import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { AiError, callGemini } from '../../../../shared/server/ai';
import { mailPrompt, readMail } from '../../_proposal';

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// POST { brand, product, subject, body, kind?: 'mail'|'dm' }: 사용자가 쓴(또는 기본 양식) 메일·인스타 DM을 AI가 다듬는다
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const body = await readJson(ctx.request);
  const kind = body?.kind === 'dm' ? 'dm' as const : 'mail' as const;
  const input = { brand: text(body?.brand, 60), product: text(body?.product, 100), subject: text(body?.subject, 120), body: text(body?.body, 3000), kind };
  if (!input.brand || !input.body) return json({ error: '업체 이름과 메일 본문이 있어야 다듬을 수 있어요.' }, 400);
  let out: string;
  try {
    ({ text: out } = await callGemini({ env: ctx.env, db: auth.db, user: auth.session.user, app: 'minilog', task: kind === 'dm' ? 'proposal_dm' : 'proposal_mail', prompt: mailPrompt(input), json: true }));
  } catch (error) {
    if (error instanceof AiError) return json({ error: error.message, code: error.code }, error.status);
    throw error;
  }
  const mail = readMail(out);
  if (!mail) return json({ error: 'AI 답을 읽지 못했어요. 다시 시도해 주세요.', code: 'bad_response' }, 502);
  return json(kind === 'dm' ? { subject: '', body: mail.body.slice(0, 1000) } : mail);
};
