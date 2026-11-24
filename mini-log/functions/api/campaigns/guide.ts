import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { AiError, callGemini } from '../../../../shared/server/ai';
import { todayKst } from '../../../../shared/server/revenue';
import { fetchGuidePage, GUIDE_PROMPT, readGuideAnswer } from '../../_guide';

// POST { text?, url?, image?: 'data:image/jpeg;base64,…' } → 협찬 칸 채울 값 + 가이드. 저장은 화면에서 확인 뒤.
const isPublicHttps = (u: URL) => u.protocol === 'https:' && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/.test(u.hostname) && u.hostname.includes('.');

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const body = await readJson(ctx.request);
  let text = typeof body?.text === 'string' ? body.text.trim().slice(0, 20000) : '';
  const images: { mimeType: string; data: string }[] = [];
  if (typeof body?.image === 'string') {
    const m = body.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m || m[2].length > 6_000_000) return json({ error: '캡처는 JPG·PNG·WEBP로, 4MB 이하로 올려 주세요.' }, 400);
    images.push({ mimeType: m[1], data: m[2] });
  }
  if (typeof body?.url === 'string' && body.url.trim()) {
    let url: URL;
    try { url = new URL(body.url.trim()); } catch { return json({ error: '주소 형식이 올바르지 않아요(https://로 시작).' }, 400); }
    if (!isPublicHttps(url)) return json({ error: 'https:// 로 시작하는 체험단 페이지 주소를 넣어 주세요.' }, 400);
    const page = await fetchGuidePage(url.toString());
    if (!page) return json({ error: '그 페이지를 읽지 못했어요(로그인이 필요하거나 막힌 사이트예요). 가이드 글을 복사해 붙여 넣거나 캡처로 올려 주세요.', code: 'unreadable' }, 422);
    text = `[페이지 주소] ${url.toString()}\n${page}\n${text}`.slice(0, 20000);
  }
  if (!text && !images.length) return json({ error: '가이드 글을 붙여 넣거나, 주소나 캡처를 넣어 주세요.' }, 400);
  let answer: string;
  try {
    ({ text: answer } = await callGemini({ env: ctx.env, db: auth.db, user: auth.session.user, app: 'minilog', task: 'guide', json: true, images,
      prompt: `${GUIDE_PROMPT(todayKst())}\n<가이드>\n${text || '(캡처 참고)'}\n</가이드>` }));
  } catch (error) {
    if (error instanceof AiError) return json({ error: error.message, code: error.code }, error.status);
    throw error;
  }
  const result = readGuideAnswer(answer);
  if (!result) return json({ error: 'AI 답을 읽지 못했어요. 다시 시도해 주세요.', code: 'bad_response' }, 502);
  return json(result);
};
