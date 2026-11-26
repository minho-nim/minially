import { json, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';
import { kstWeekStart, monthStart, operationStats, todayUsage } from '../../../shared/server/usage';
import { revenueOverview } from '../../../shared/server/revenue';

// 미니허브 통합 대시보드: 사용자 C·D 전체의 운영 숫자(로그인한 사용자만).
// 키·원고·사진·문체 글은 넣지 않는다. 협찬·수익 요약은 소유자 요청으로 넣는다(로그인한 C·D만 봄).
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'hub');
  if (auth instanceof Response) return auth;
  const since = monthStart();
  const stats = await operationStats(auth.db, ctx.env, since);
  const published = await auth.db.prepare("SELECT user, COUNT(*) AS count FROM minilog_drafts WHERE status = 'published' AND published_at >= ? GROUP BY user")
    .bind(since).all<{ user: string; count: number }>();
  const week = await auth.db.prepare("SELECT user, COUNT(*) AS count FROM minilog_drafts WHERE status = 'published' AND published_at >= ? GROUP BY user")
    .bind(kstWeekStart()).all<{ user: string; count: number }>();
  const shares = await auth.db.prepare('SELECT user, COUNT(*) AS count FROM minilog_shares WHERE shared_at >= ? GROUP BY user').bind(since).all<{ user: string; count: number }>();
  return json({ ...stats, minilog_published: published.results, minilog_week: week.results, minilog_shares: shares.results, revenue: await revenueOverview(auth.db), today: await todayUsage(auth.db) });
};
