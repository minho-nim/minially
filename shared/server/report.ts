import type { D1Database } from './d1';

// 월간 보고: 한 사람의 한 달 숫자(게시 글·조회·공감·수익·AI 사용량)와 지난달 비교.
// 미니로그(본인)와 미니허브(C·D 함께·비교)가 같이 쓴다. 숫자와 글 제목만 다루고 본문은 넣지 않는다.

export const validMonth = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
export const prevMonth = (month: string) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7); };
const nextMonth = (month: string) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7); };
/** 한국 시간 기준 그달 1일 0시 ~ 다음 달 1일 0시(밀리초) */
const monthRange = (month: string) => [Date.parse(`${month}-01T00:00:00+09:00`), Date.parse(`${nextMonth(month)}-01T00:00:00+09:00`)] as const;

export interface MonthSummary {
  posts: number; minilog_published: number; views: number; likes: number; comments: number; with_stats: number;
  revenue: number; sponsor_revenue: number; ad_revenue: number; other_revenue: number; sponsor_count: number;
  ai_calls: number; ai_tokens: number; ai_errors: number;
}
export interface ReportPost { title: string; url: string; blog_id: string; published_on: string | null; views: number | null; likes: number | null; comments: number | null }
export interface MonthlyReport {
  month: string; user: string; summary: MonthSummary; prev: MonthSummary;
  posts: ReportPost[]; top: ReportPost[]; blogs: string[]; tags: { tag: string; count: number }[];
  revenue_items: { kind: string; brand: string; title: string; amount: number; paid_on: string }[];
  comments: string[];
}

async function summary(db: D1Database, user: string, month: string): Promise<MonthSummary> {
  const [from, to] = monthRange(month);
  const like = `${month}-%`;
  const [posts, drafts, paid, sponsors, ai] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(views), 0) AS views, COALESCE(SUM(likes), 0) AS likes, COALESCE(SUM(comments), 0) AS comments, COUNT(views) AS with_stats FROM minilog_posts WHERE user = ? AND published_on LIKE ?')
      .bind(user, like).first<{ n: number; views: number; likes: number; comments: number; with_stats: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM minilog_drafts WHERE user = ? AND status = 'published' AND published_at >= ? AND published_at < ?").bind(user, from, to).first<{ n: number }>(),
    db.prepare("SELECT kind, COALESCE(SUM(amount), 0) AS total FROM minilog_campaigns WHERE user = ? AND status = 'paid' AND paid_on LIKE ? GROUP BY kind").bind(user, like).all<{ kind: string; total: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM minilog_campaigns WHERE user = ? AND kind = 'sponsor' AND status IN ('posted', 'paid') AND (deadline LIKE ? OR paid_on LIKE ?)").bind(user, like, like).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS calls, COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens, COALESCE(SUM(CASE WHEN status != 'ok' THEN 1 ELSE 0 END), 0) AS errors FROM ai_usage WHERE user = ? AND created_at >= ? AND created_at < ?")
      .bind(user, from, to).first<{ calls: number; tokens: number; errors: number }>(),
  ]);
  const byKind = (k: string) => paid.results.find(r => r.kind === k)?.total ?? 0;
  return {
    posts: posts?.n ?? 0, minilog_published: drafts?.n ?? 0, views: posts?.views ?? 0, likes: posts?.likes ?? 0, comments: posts?.comments ?? 0, with_stats: posts?.with_stats ?? 0,
    revenue: paid.results.reduce((n, r) => n + r.total, 0), sponsor_revenue: byKind('sponsor'), ad_revenue: byKind('ad'), other_revenue: byKind('other'), sponsor_count: sponsors?.n ?? 0,
    ai_calls: ai?.calls ?? 0, ai_tokens: ai?.tokens ?? 0, ai_errors: ai?.errors ?? 0,
  };
}

export async function monthlyReport(db: D1Database, user: string, month: string): Promise<MonthlyReport> {
  const like = `${month}-%`;
  const [now, prev, posts, blogs, items] = await Promise.all([
    summary(db, user, month), summary(db, user, prevMonth(month)),
    db.prepare('SELECT title, url, blog_id, published_on, views, likes, comments, tags FROM minilog_posts WHERE user = ? AND published_on LIKE ? ORDER BY published_on, created_at LIMIT 200')
      .bind(user, like).all<ReportPost & { tags: string }>(),
    db.prepare('SELECT blog_id FROM minilog_blogs WHERE user = ? ORDER BY created_at').bind(user).all<{ blog_id: string }>(),
    db.prepare("SELECT kind, brand, title, amount, paid_on FROM minilog_campaigns WHERE user = ? AND status = 'paid' AND paid_on LIKE ? ORDER BY paid_on").bind(user, like)
      .all<{ kind: string; brand: string; title: string; amount: number; paid_on: string }>(),
  ]);
  const tagCount = new Map<string, number>();
  for (const p of posts.results) for (const t of (p.tags || '').split(',').filter(Boolean)) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const list = posts.results.map(({ tags: _tags, ...p }) => p);
  const top = list.filter(p => p.views !== null).sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 5);
  const tags = [...tagCount].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, count]) => ({ tag, count }));
  return {
    month, user, summary: now, prev, posts: list, top, blogs: blogs.results.map(b => b.blog_id), tags, revenue_items: items.results,
    comments: reportComments({ month, summary: now, prev, top, tags }),
  };
}

// 그달에 올리면 좋은 글감(달 번호 = 그 달). 보고 달의 '다음 달' 것을 안내한다.
const NEXT_MONTH_TIP: Record<number, string> = {
  1: '새해 계획·설 선물', 2: '발렌타인데이·졸업·입학', 3: '화이트데이·벚꽃 명소', 4: '봄 나들이·어린이날 선물', 5: '가정의 달·피크닉', 6: '초여름 여행·장마 대비',
  7: '여름휴가·복날 보양식', 8: '휴가 후기·가을 신상', 9: '추석·가을 나들이', 10: '단풍·핼러윈·캠핑', 11: '김장·수능·빼빼로데이', 12: '크리스마스·연말 모임',
};

/** 규칙 기반 한 줄 평(AI 없이 숫자로만, 지어낸 말 없음). 0~5문장. */
export function reportComments(r: Pick<MonthlyReport, 'month' | 'summary' | 'prev' | 'top' | 'tags'>): string[] {
  const s = r.summary, p = r.prev, out: string[] = [];
  const n = (v: number) => v.toLocaleString('ko-KR');
  const pct = (a: number, b: number) => Math.round((Math.abs(a - b) / b) * 100);
  if (s.posts === 0) out.push('이 달에는 올린 글이 없어요(블로그 탭에서 글을 가져와야 보여요).');
  else if (s.posts > p.posts) out.push(`글 ${s.posts}개를 올려 지난달보다 ${s.posts - p.posts}개 늘었어요.`);
  else if (s.posts < p.posts) out.push(`글 ${s.posts}개를 올렸어요(지난달 ${p.posts}개).`);
  else out.push(`글 ${s.posts}개를 올렸어요(지난달과 같아요).`);
  if (s.with_stats > 0 && p.views > 0 && s.views !== p.views) out.push(`조회수 합계는 ${n(s.views)}회로 지난달보다 ${s.views > p.views ? '▲' : '▼'}${pct(s.views, p.views)}%예요.`);
  else if (s.with_stats > 0) out.push(`조회수 합계는 ${n(s.views)}회예요.`);
  const best = r.top[0];
  if (best && best.views) out.push(`가장 많이 본 글은 '${best.title.slice(0, 30)}'(${n(best.views)}회)예요.`);
  if (r.tags[0] && r.tags[0].count >= 2) out.push(`#${r.tags[0].tag} 글을 ${r.tags[0].count}개로 가장 많이 썼어요.`);
  if (s.revenue > 0) out.push(`받은 금액은 ${n(s.revenue)}원${p.revenue > 0 ? `(지난달 ${n(p.revenue)}원)` : ''}이에요.`);
  const next = Number(r.month.slice(5)) % 12 + 1;
  out.push(`다음 달엔 ${NEXT_MONTH_TIP[next]} 글을 미리 준비해 보세요.`);
  return out.slice(0, 6);
}
