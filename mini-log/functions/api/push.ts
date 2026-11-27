import { json, readJson, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';
import { cleanSubscription, vapidKeys } from '../_brief';

// 아침 알림 구독(이 기기). GET: 공개 키(알림 켜기에 필요)와 이 계정의 구독 수. POST: 이 기기 구독 저장. DELETE: 이 기기 구독 지우기
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const keys = vapidKeys(ctx.env);
  const n = await auth.db.prepare('SELECT COUNT(*) AS n FROM minilog_push WHERE user = ?').bind(auth.session.user).first<{ n: number }>();
  return json({ public_key: keys?.pub ?? null, devices: n?.n ?? 0 });
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  if (!vapidKeys(ctx.env)) return json({ error: '알림 키가 아직 설정되지 않았어요(관리자가 설정 화면에서 만들어 Cloudflare에 넣어요).' }, 409);
  const sub = cleanSubscription(await readJson(ctx.request), ctx.env);
  if (!sub) return json({ error: '알림 구독 정보가 올바르지 않아요.' }, 400);
  const count = await auth.db.prepare('SELECT COUNT(*) AS n FROM minilog_push WHERE user = ? AND endpoint != ?').bind(auth.session.user, sub.endpoint).first<{ n: number }>();
  if ((count?.n ?? 0) >= 10) return json({ error: '알림은 기기 10대까지 켤 수 있어요. 안 쓰는 기기에서 먼저 꺼 주세요.' }, 409);
  await auth.db.prepare('INSERT INTO minilog_push (endpoint, user, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user = excluded.user, p256dh = excluded.p256dh, auth = excluded.auth')
    .bind(sub.endpoint, auth.session.user, sub.p256dh, sub.auth, Date.now()).run();
  return json({ ok: true }, 201);
};

export const onRequestDelete = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const body = await readJson(ctx.request);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  await auth.db.prepare('DELETE FROM minilog_push WHERE user = ? AND endpoint = ?').bind(auth.session.user, endpoint).run();
  return json({ ok: true });
};
