// POST /api/google-calendar { url, today } → { events } : 구글 캘린더 'iCal 형식의 비공개 주소'에서 다가오는 일정 후보만 읽어 준다.
// 로그인: 미니어리 동기화 코드(Bearer). 주소·일정은 서버에 저장하지 않는다. 일정은 앱에서 사람이 고른 것만 저장한다.
import { json, ensureSchema, spaceFor, blocked, recordFailure, tooManyResponse, type Context } from '../_lib';
import { cleanIcsUrl, fetchIcs, parseIcs } from '../_googleIcs';

export const onRequestPost = async ({ request, env }: Context): Promise<Response> => {
  if (!env.DB) return json({ error: '서버 설정이 아직 끝나지 않았습니다.' }, 503);
  await ensureSchema(env.DB);
  if (await blocked(env.DB, request)) return tooManyResponse();
  if (!(await spaceFor(request, env))) { await recordFailure(env.DB, request); return json({ error: '로그인이 필요해요.' }, 401); }
  let body: { url?: unknown; today?: unknown } | null = null;
  try { body = await request.json(); } catch { body = null; }
  const testOrigin = typeof (env as { GOOGLE_ICS_TEST_ORIGIN?: unknown }).GOOGLE_ICS_TEST_ORIGIN === 'string' ? (env as { GOOGLE_ICS_TEST_ORIGIN: string }).GOOGLE_ICS_TEST_ORIGIN : '';
  const url = cleanIcsUrl(body?.url, testOrigin);
  if (!url) return json({ error: "구글 캘린더 설정 → 캘린더 통합의 'iCal 형식의 비공개 주소'(calendar.google.com/…/basic.ics)를 붙여 넣어 주세요.", code: 'bad_url' }, 400);
  const today = typeof body?.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const text = await fetchIcs(url);
  if (text === null || !text.includes('BEGIN:VCALENDAR')) return json({ error: '구글 캘린더를 읽지 못했어요. 주소가 맞는지, 주소를 다시 만들지 않았는지 확인해 주세요.', code: 'fetch_failed' }, 502);
  return json({ events: parseIcs(text, today) });
};
