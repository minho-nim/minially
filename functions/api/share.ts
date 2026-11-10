// 내 일정 공유 코드 만들기·바꾸기·끄기(내 코드로 로그인한 사람만).
// 공유 코드는 보기 전용이다. 서버에는 해시만 저장하고, 원문은 만든 순간 한 번 돌려준다(앱이 내 설정에 저장해 내 기기끼리 맞춤).
import { json, spaceFor, ensureSchema, sha256Hex, normalizeCode, randomCode, blocked, recordFailure, tooManyResponse, type Context } from '../_lib';

export const onRequestPost = async ({ request, env }: Context): Promise<Response> => {
  if (!env.DB || !env.SYNC_CODE_HASHES) return json({ error: '서버 동기화가 아직 설정되지 않았습니다.' }, 503);
  const db = env.DB;
  await ensureSchema(db);
  if (await blocked(db, request)) return tooManyResponse();
  const space = await spaceFor(request, env);
  if (!space) { await recordFailure(db, request); return json({ error: '코드가 맞지 않습니다.' }, 401); }
  let body: { action?: string };
  try { body = await request.json(); } catch { return json({ error: 'JSON 형식이 아닙니다.' }, 400); }
  if (body.action === 'disable') {
    await db.prepare('DELETE FROM sync_shares WHERE space = ?').bind(space).run();
    return json({ ok: true });
  }
  if (body.action === 'rotate') {
    const code = randomCode();
    const hash = await sha256Hex(normalizeCode(code));
    await db.batch([
      db.prepare('DELETE FROM sync_shares WHERE space = ?').bind(space),
      db.prepare('INSERT INTO sync_shares (share_hash, space, created_at) VALUES (?, ?, ?)').bind(hash, space, Date.now()),
    ]);
    return json({ code });
  }
  return json({ error: '알 수 없는 요청입니다.' }, 400);
};
