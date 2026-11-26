// POST /api/photo-schedule { image: "data:image/jpeg;base64,…" | text: "붙여넣은 글", today: "YYYY-MM-DD" } → { events: [...] }
// text는 글로 넣기에서 기기 안 규칙이 못 찾아 사람이 'AI로 다시 읽기'를 누를 때만 온다.
// 로그인: 미니어리 동기화 코드(Bearer). 같은 코드가 미니허브 사용자(USER_CODE_HASHES)이면 그 사람의 Gemini 키로 읽는다.
// 사진은 저장하지 않는다. 일정은 앱에서 사람이 고른 것만 저장한다(이 API는 후보만 돌려준다).
import { json, ensureSchema, spaceFor, bearer, blocked, recordFailure, tooManyResponse, type Context } from '../_lib';
import { AiError, callGemini } from '../../../shared/server/ai';
import { userForCode } from '../../../shared/server/auth';
import { ensureHubSchema } from '../../../shared/server/schema';
import type { HubEnv } from '../../../shared/server/d1';
import { PHOTO_LIMITS, PHOTO_MODEL, crossCheck, photoPrompt, readPhotoEvents, readTranscript, textPrompt } from '../_photoSchedule';

export const onRequestPost = async ({ request, env }: Context): Promise<Response> => {
  if (!env.DB) return json({ error: '서버 설정이 아직 끝나지 않았습니다.' }, 503);
  const db = env.DB;
  await ensureSchema(db);
  if (await blocked(db, request)) return tooManyResponse();
  if (!(await spaceFor(request, env))) { await recordFailure(db, request); return json({ error: '로그인이 필요해요.' }, 401); }
  const hubEnv = env as unknown as HubEnv;
  const user = await userForCode(bearer(request), hubEnv);
  if (!user) return json({ error: '사진 읽기가 아직 연결되지 않았어요. 관리자에게 연결을 부탁해 주세요.', code: 'no_key' }, 409);

  let body: { image?: unknown; text?: unknown; today?: unknown } | null = null;
  try { body = await request.json(); } catch { body = null; }
  const pasted = typeof body?.text === 'string' && body?.image === undefined ? body.text.trim() : null;
  if (pasted !== null && (!pasted || pasted.length > PHOTO_LIMITS.text)) return json({ error: `글은 ${PHOTO_LIMITS.text}자까지 넣어 주세요.` }, 400);
  const m = pasted === null && typeof body?.image === 'string' ? body.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
  if (pasted === null && (!m || m[2].length > PHOTO_LIMITS.base64)) return json({ error: '사진은 JPG·PNG·WEBP 한 장, 4MB 이하로 올려 주세요.' }, 400);
  const today = typeof body?.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

  await ensureHubSchema(db as never);
  let text: string;
  try {
    const model = (typeof hubEnv.GEMINI_PHOTO_MODEL === 'string' && hubEnv.GEMINI_PHOTO_MODEL) || PHOTO_MODEL;
    ({ text } = pasted !== null
      ? await callGemini({ env: hubEnv, db: db as never, user, app: 'minially', task: 'text_schedule', prompt: textPrompt(today, pasted), json: true, model })
      : await callGemini({ env: hubEnv, db: db as never, user, app: 'minially', task: 'photo_schedule', prompt: photoPrompt(today), images: [{ mimeType: m![1], data: m![2] }], json: true, model }));
  } catch (error) {
    if (error instanceof AiError) return json({ error: error.message, code: error.code }, error.status);
    throw error;
  }
  let raw: unknown = null;
  try { raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { return json({ error: pasted !== null ? '글을 읽지 못했어요. 다시 시도해 주세요.' : '사진을 읽지 못했어요. 다시 시도해 주세요.', code: 'bad_response' }, 502); }
  // 사진은 AI가 옮겨 적은 글, 글로 넣기는 붙여넣은 글로 날짜·시간을 한 번 더 확인한다
  return json({ events: crossCheck(readPhotoEvents(raw), pasted ?? readTranscript(raw), today) });
};
