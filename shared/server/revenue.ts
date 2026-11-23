import type { D1Database } from './d1';

// 미니허브 통합 대시보드용 협찬·광고 수익 요약(C·D 모두). 소유자 요청으로 통합 화면에서 본다.
// Minoffia 통계 API(/api/stats)에는 넣지 않는다(협찬 계약 정보 외부 전달 금지).

/** 한국 날짜 YYYY-MM-DD */
export const todayKst = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(0, 10);

export function lastMonths(today: string, count = 6) {
  const [y, m] = today.slice(0, 7).split('-').map(Number);
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1)).toISOString().slice(0, 7));
}

export async function revenueOverview(db: D1Database, today = todayKst()) {
  const month = today.slice(0, 7);
  const months = lastMonths(today);
  const [paid, open, upcoming] = await Promise.all([
    db.prepare("SELECT user, substr(paid_on, 1, 7) AS month, SUM(amount) AS total FROM minilog_campaigns WHERE status = 'paid' AND paid_on >= ? GROUP BY user, month")
      .bind(`${months[0]}-01`).all<{ user: string; month: string; total: number }>(),
    db.prepare("SELECT user, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM minilog_campaigns WHERE status IN ('proposed', 'in_progress', 'posted') GROUP BY user")
      .all<{ user: string; count: number; total: number }>(),
    db.prepare("SELECT user, brand, title, deadline, status, amount FROM minilog_campaigns WHERE status IN ('proposed', 'in_progress', 'posted') AND deadline IS NOT NULL AND deadline >= ? ORDER BY deadline LIMIT 8")
      .bind(today).all<{ user: string; brand: string; title: string; deadline: string; status: string; amount: number }>(),
  ]);
  const users = [...new Set([...paid.results.map(r => r.user), ...open.results.map(r => r.user)])];
  return {
    month,
    months: months.map(mm => ({ month: mm, total: paid.results.filter(r => r.month === mm).reduce((n, r) => n + r.total, 0) })),
    users: users.map(user => ({
      user,
      this_month: paid.results.find(r => r.user === user && r.month === month)?.total ?? 0,
      open_count: open.results.find(r => r.user === user)?.count ?? 0,
      open_total: open.results.find(r => r.user === user)?.total ?? 0,
    })),
    upcoming: upcoming.results,
  };
}
