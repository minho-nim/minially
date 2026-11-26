// 수요 예측(내 데이터만): 작년 이맘때 내 글 · 다가오는 시기와 내 지난 글 · 꾸준히 잘 되는 태그 → 다음 4주에 쓸 주제와 올릴 날.
// AI·외부 API를 부르지 않는다. 네이버 데이터랩은 키·요금을 확인하고 소유자가 정하면 붙인다(docs/HANDOFF_TO_CODEX.md).
// 조회수는 사용자가 마지막으로 넣은 누적 숫자라, 오래된 글이 조금 유리하다.
import type { Post } from './_blog';
import { upcomingSeasons } from './_ideas';

export const DEMAND_DAYS = 28; // 앞으로 4주
const LEAD_DAYS = 14; // 시기는 2주 전에 올린다(글감 화면의 '1~3주 전' 안내와 같음)
const YEAR_DAYS = 364; // 52주: 요일이 같고 윤년을 따지지 않아도 된다
const MAX_ITEMS = 8;
// 시기 이름에서 글 찾기에 쓰지 않는 흔한 말
const GENERIC = new Set(['선물', '준비', '여행', '데이트', '신상', '명소', '실내', '나들이', '모임', '연휴', '계획', '다이어리']);

export type DemandBasis = 'last_year' | 'season' | 'steady';
export interface DemandItem {
  topic: string;
  post_by: string | null; // 올리면 좋은 날(YYYY-MM-DD). 꾸준한 주제는 null(언제든)
  reason: string;
  basis: DemandBasis;
  views: number | null;
  url: string | null;
  tags: string[];
}
export interface WeekdayStat { day: number; label: string; posts: number; avg: number }
export interface Demand { from: string; to: string; items: DemandItem[]; posts_with_views: number; posts_last_year: number; weekdays: { days: WeekdayStat[]; best: WeekdayStat | null } }

const DAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];
/**
 * 올리기 좋은 요일(Buffer·Metricool의 '좋은 시간'을 내 데이터로): 게시 요일별 평균 조회수.
 * 조회수 있는 글이 6편 이상이고, 2편 이상 올린 요일끼리만 비교해 가장 높은 요일을 best로 둔다.
 */
export function weekdayStats(posts: Post[]): { days: WeekdayStat[]; best: WeekdayStat | null } {
  const sums = DAY_LABEL.map(() => ({ posts: 0, sum: 0 }));
  for (const p of posts) {
    if (!p.published_on || p.views === null) continue;
    const day = new Date(`${p.published_on}T00:00:00Z`).getUTCDay();
    sums[day].posts += 1; sums[day].sum += p.views;
  }
  const days = sums.map((s, day) => ({ day, label: DAY_LABEL[day], posts: s.posts, avg: s.posts ? Math.round(s.sum / s.posts) : 0 }));
  const total = days.reduce((n, d) => n + d.posts, 0);
  const candidates = days.filter(d => d.posts >= 2);
  const best = total >= 6 && candidates.length >= 2 ? candidates.reduce((a, b) => (b.avg > a.avg ? b : a)) : null;
  return { days, best };
}

const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const md = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
const n = (v: number) => v.toLocaleString('ko-KR');
const later = (a: string, b: string) => (a > b ? a : b);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const byViews = (a: Post, b: Post) => (b.views ?? -1) - (a.views ?? -1) || (b.published_on ?? '').localeCompare(a.published_on ?? '');

export function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

/** 시기 이름('크리스마스·연말 선물')에서 내 글을 찾을 말('크리스마스', '연말') */
export function seasonWords(label: string) {
  return label.split(/[·\s]+/).map(w => w.trim()).filter(w => w.length >= 2 && !GENERIC.has(w));
}

/** 오늘(한국 날짜)과 내 블로그 글로 앞으로 4주 수요 예측을 만든다. */
export function forecastDemand(posts: Post[], today: string): Demand {
  const to = shift(today, DEMAND_DAYS);
  const dated = posts.filter((p): p is Post & { published_on: string } => !!p.published_on && p.published_on < today);
  const withViews = dated.filter(p => p.views !== null);
  const typical = median(withViews.map(p => p.views ?? 0));
  const used = new Set<string>();
  const items: DemandItem[] = [];

  // 1) 작년 이맘때(52주 전 1주 앞 ~ 4주 뒤)에 올린 글 중 조회수가 내 보통 글 이상인 것
  const lastYear = dated.filter(p => p.published_on >= shift(today, -YEAR_DAYS - 7) && p.published_on <= shift(to, -YEAR_DAYS));
  for (const p of lastYear.filter(p => p.views === null || p.views >= typical).sort(byViews).slice(0, 3)) {
    used.add(p.url);
    items.push({
      topic: p.title || '제목 없는 글', post_by: later(today, shift(p.published_on, YEAR_DAYS - 7)), basis: 'last_year', views: p.views, url: p.url, tags: p.tags.slice(0, 5),
      reason: `작년 ${md(p.published_on)}에 올린 글${p.views !== null ? ` · 조회 ${n(p.views)}회` : ''} · 올해 새 경험으로 다시 쓰기`,
    });
  }

  // 2) 다가오는 시기: 2주 전에 올리기. 내가 예전에 쓴 같은 시기 글이 있으면 그 숫자를 함께
  for (const s of upcomingSeasons(today, DEMAND_DAYS + LEAD_DAYS)) {
    const postBy = later(today, shift(s.from, -LEAD_DAYS));
    if (postBy > to || s.to < shift(today, 7)) continue; // 4주 뒤에 올릴 시기, 일주일 안에 끝나는 시기는 뺀다
    const words = seasonWords(s.label);
    const mine = dated.filter(p => !used.has(p.url) && words.some(w => p.title.includes(w) || p.tags.some(t => t.includes(w)))).sort(byViews)[0];
    if (mine) used.add(mine.url);
    items.push({
      topic: s.label, post_by: postBy, basis: 'season', views: mine?.views ?? null, url: mine?.url ?? null, tags: words.slice(0, 5),
      reason: `${md(s.from)}~${md(s.to)} 시기 · ` + (mine ? `예전 글 「${mine.title.slice(0, 30)}」${mine.views !== null ? ` 조회 ${n(mine.views)}회` : ''}` : '내 글은 아직 없어요'),
    });
  }

  // 3) 꾸준히 잘 되는 태그: 조회수 있는 글 2편 이상, 평균이 보통 글의 1.2배 이상, 30일 넘게 안 쓴 것
  const tags = new Map<string, { count: number; sum: number; last: string }>();
  for (const p of withViews) for (const t of new Set(p.tags)) {
    const g = tags.get(t) ?? { count: 0, sum: 0, last: '' };
    tags.set(t, { count: g.count + 1, sum: g.sum + (p.views ?? 0), last: later(g.last, p.published_on) });
  }
  const recentTags = new Set(dated.filter(p => p.published_on > shift(today, -30)).flatMap(p => p.tags));
  const steady = [...tags].map(([tag, g]) => ({ tag, ...g, avg: Math.round(g.sum / g.count) }))
    .filter(g => g.count >= 2 && g.avg > 0 && g.avg >= typical * 1.2 && !recentTags.has(g.tag))
    .sort((a, b) => b.avg - a.avg).slice(0, 2);
  for (const g of steady) {
    items.push({ topic: g.tag, post_by: null, basis: 'steady', views: g.avg, url: null, tags: [g.tag], reason: `글 ${g.count}편 평균 조회 ${n(g.avg)}회 · 마지막 글 ${daysBetween(g.last, today)}일 전` });
  }

  items.sort((a, b) => (a.post_by ?? '9999').localeCompare(b.post_by ?? '9999'));
  return { from: today, to, items: items.slice(0, MAX_ITEMS), posts_with_views: withViews.length, posts_last_year: lastYear.length, weekdays: weekdayStats(dated) };
}
