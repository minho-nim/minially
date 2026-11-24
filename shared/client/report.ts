// 월간 보고 화면 공용(미니로그·미니허브): 서버 응답 타입과 비교 계산
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
  /** 규칙 기반 한 줄 평(숫자로만 만든 문장) */
  comments: string[];
}

export const monthLabel = (month: string) => `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;
export const shiftMonth = (month: string, by: number) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7); };
export const thisMonthKst = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7);

/** 지난달 대비: '+3 (▲25%)' / '−2' / '변화 없음' / 지난달 0이면 '새로 생김' */
export function diffText(now: number, before: number) {
  if (now === before) return '지난달과 같아요';
  const sign = now > before ? '+' : '−';
  const amount = Math.abs(now - before).toLocaleString('ko-KR');
  if (before === 0) return `${sign}${amount} (지난달 0)`;
  const pct = Math.round((Math.abs(now - before) / before) * 100);
  return `${sign}${amount} (${now > before ? '▲' : '▼'}${pct}%)`;
}
export const diffKind = (now: number, before: number) => (now > before ? 'up' : now < before ? 'down' : 'same');

/** 여러 사람 숫자 합치기(미니허브 합계) */
export function sumSummaries(list: MonthSummary[]): MonthSummary {
  const keys = Object.keys(list[0] ?? {}) as (keyof MonthSummary)[];
  return Object.fromEntries(keys.map(k => [k, list.reduce((n, s) => n + s[k], 0)])) as unknown as MonthSummary;
}

export const KIND_LABEL: Record<string, string> = { sponsor: '협찬', ad: '광고', other: '기타' };
