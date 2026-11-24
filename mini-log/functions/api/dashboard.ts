import { json, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';
import { geminiStatus, monthStart } from '../../../shared/server/usage';
import { revenueSummary } from '../_campaigns';

// 미니로그 개인 대시보드: 로그인한 사용자 본인 숫자만(원고 내용·사진·키는 내보내지 않음).
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session: { user } } = auth;
  const since = monthStart();
  const now = Date.now();
  const [ai, tasks, errors, statuses, publishedThisMonth, photos, expiring] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS calls, SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors, COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens FROM ai_usage WHERE user = ? AND app = 'minilog' AND created_at >= ?")
      .bind(user, since).first<{ calls: number; errors: number | null; input_tokens: number; output_tokens: number }>(),
    db.prepare("SELECT task, COUNT(*) AS calls, COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens FROM ai_usage WHERE user = ? AND app = 'minilog' AND created_at >= ? GROUP BY task ORDER BY calls DESC")
      .bind(user, since).all<{ task: string; calls: number; tokens: number }>(),
    db.prepare("SELECT error_code, COUNT(*) AS count FROM ai_usage WHERE user = ? AND app = 'minilog' AND created_at >= ? AND status = 'error' GROUP BY error_code ORDER BY count DESC")
      .bind(user, since).all<{ error_code: string; count: number }>(),
    db.prepare('SELECT status, COUNT(*) AS count FROM minilog_drafts WHERE user = ? GROUP BY status').bind(user).all<{ status: string; count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM minilog_drafts WHERE user = ? AND status = 'published' AND published_at >= ?").bind(user, since).first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes FROM minilog_photos WHERE user = ?').bind(user).first<{ count: number; bytes: number }>(),
    db.prepare('SELECT d.id, d.title, COUNT(*) AS count, MIN(p.expires_at) AS expires_at FROM minilog_photos p JOIN minilog_drafts d ON d.id = p.draft_id AND d.user = p.user WHERE p.user = ? AND p.expires_at IS NOT NULL AND p.expires_at > ? GROUP BY d.id ORDER BY expires_at LIMIT 5')
      .bind(user, now).all<{ id: string; title: string; count: number; expires_at: number }>(),
  ]);
  const topPosts = (await db.prepare('SELECT title, url, views, likes FROM minilog_posts WHERE user = ? AND views IS NOT NULL ORDER BY views DESC LIMIT 3').bind(user).all<{ title: string; url: string; views: number; likes: number | null }>()).results;
  // 최근 6개월 게시 글 수(한국 시간 기준 달)
  const kstMonth = (ms: number) => new Date(ms + 9 * 3600000).toISOString().slice(0, 7);
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(now + 9 * 3600000); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); months.push(d.toISOString().slice(0, 7)); }
  const firstMs = Date.parse(`${months[0]}-01T00:00:00+09:00`);
  const published = (await db.prepare("SELECT published_at FROM minilog_drafts WHERE user = ? AND status = 'published' AND published_at >= ?").bind(user, firstMs).all<{ published_at: number }>()).results;
  const publishedMonths = months.map(month => ({ month, count: published.filter(r => kstMonth(r.published_at) === month).length }));
  const goal = await db.prepare('SELECT monthly FROM minilog_goals WHERE user = ?').bind(user).first<{ monthly: number }>();
  const byStatus = Object.fromEntries(statuses.results.map(r => [r.status, r.count]));
  return json({
    since: new Date(since).toISOString(),
    gemini: geminiStatus(ctx.env, user),
    ai: { calls: ai?.calls ?? 0, errors: ai?.errors ?? 0, input_tokens: ai?.input_tokens ?? 0, output_tokens: ai?.output_tokens ?? 0, tasks: tasks.results, error_codes: errors.results },
    drafts: { draft: byStatus.draft ?? 0, approved: byStatus.approved ?? 0, published: byStatus.published ?? 0, published_this_month: publishedThisMonth?.count ?? 0, months: publishedMonths },
    photos: { count: photos?.count ?? 0, bytes: photos?.bytes ?? 0, expiring: expiring.results.map(r => ({ ...r, title: r.title.slice(0, 80) })) },
    // 날짜는 한국 시간 기준(정산일을 사람이 YYYY-MM-DD로 적기 때문)
    top_posts: topPosts,
    goal: goal?.monthly ?? null,
    revenue: await revenueSummary(db, user, new Date(now + 9 * 3600000).toISOString().slice(0, 10)),
  });
};
