import { json, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';
import { monthStart, operationStats } from '../../../shared/server/usage';

// 미니허브 통합 대시보드: 사용자 C·D 전체의 운영 숫자(로그인한 사용자만).
// 숫자만 내보낸다: 키·원고·사진·문체 글은 넣지 않는다.
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'hub');
  if (auth instanceof Response) return auth;
  const since = monthStart();
  const stats = await operationStats(auth.db, ctx.env, since);
  const published = await auth.db.prepare("SELECT user, COUNT(*) AS count FROM minilog_drafts WHERE status = 'published' AND published_at >= ? GROUP BY user")
    .bind(since).all<{ user: string; count: number }>();
  return json({ ...stats, minilog_published: published.results });
};
