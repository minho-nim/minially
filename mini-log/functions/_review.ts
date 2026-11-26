import type { D1Database } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';
import { median } from './_demand';

// 게시 7일 뒤 돌아보기: 올린 지 7~60일 된 원고를 하나씩 보고 사람이 평가·메모를 남긴다(AI 안 씀).
// 조회수는 블로그 글 목록(minilog_posts)에서 이 원고와 이어진 글의 숫자를 쓴다(사람이 넣었거나 가져온 값).
export const VERDICTS = ['good', 'ok', 'low'] as const;
export type Verdict = typeof VERDICTS[number];
export const REVIEW = { afterDays: 7, withinDays: 60, note: 300, due: 5, recent: 5 };
const DAY = 86400000;

export interface DueReview { draft_id: string; title: string; published_at: number; url: string; views: number | null; likes: number | null; comments: number | null; ratio: number | null }
export interface SavedReview { draft_id: string; title: string; verdict: Verdict; note: string; views: number | null; created_at: number }

/** 평소(내 글 조회수 중앙값)의 몇 배인지. 비교할 글이 5편 안 되거나 조회수가 없으면 null */
export function viewRatio(views: number | null, all: number[]) {
  if (views === null || all.length < 5) return null;
  const typical = median(all);
  return typical > 0 ? Math.round((views / typical) * 10) / 10 : null;
}

/** 저장할 평가 검사: { draft_id, verdict, note } → 값 또는 오류 문구 */
export function readReview(body: Record<string, unknown> | null): { draft_id: string; verdict: Verdict; note: string } | string {
  if (!body) return 'JSON 형식이 아닙니다.';
  const id = body.draft_id;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return '원고를 찾을 수 없어요.';
  if (typeof body.verdict !== 'string' || !(VERDICTS as readonly string[]).includes(body.verdict)) return '평가는 잘 됨·보통·아쉬움 중에서 골라 주세요.';
  const note = body.note === undefined ? '' : body.note;
  if (typeof note !== 'string') return '메모는 글자로만 저장할 수 있어요.';
  const clean = note.replace(/\r\n?/g, '\n').trim();
  if (clean.length > REVIEW.note) return `메모는 ${REVIEW.note}자까지예요.`;
  return { draft_id: id, verdict: body.verdict as Verdict, note: clean };
}

export async function reviewState(db: D1Database, user: UserName, now = Date.now()) {
  const [due, recent, views] = await Promise.all([
    db.prepare(`SELECT d.id AS draft_id, d.title, d.published_at, COALESCE(d.published_url, '') AS url, p.views, p.likes, p.comments
      FROM minilog_drafts d
      LEFT JOIN minilog_posts p ON p.user = d.user AND p.draft_id = d.id
      LEFT JOIN minilog_reviews r ON r.user = d.user AND r.draft_id = d.id
      WHERE d.user = ? AND d.status = 'published' AND d.published_at <= ? AND d.published_at >= ? AND r.draft_id IS NULL
      GROUP BY d.id ORDER BY d.published_at LIMIT ?`)
      .bind(user, now - REVIEW.afterDays * DAY, now - REVIEW.withinDays * DAY, REVIEW.due).all<Omit<DueReview, 'ratio'>>(),
    db.prepare(`SELECT r.draft_id, d.title, r.verdict, r.note, r.views, r.created_at FROM minilog_reviews r JOIN minilog_drafts d ON d.user = r.user AND d.id = r.draft_id
      WHERE r.user = ? ORDER BY r.created_at DESC LIMIT ?`).bind(user, REVIEW.recent).all<SavedReview>(),
    db.prepare('SELECT views FROM minilog_posts WHERE user = ? AND views IS NOT NULL').bind(user).all<{ views: number }>(),
  ]);
  const all = views.results.map(r => r.views);
  return {
    due: due.results.map(r => ({ ...r, title: r.title.trim() || '제목 없는 원고', ratio: viewRatio(r.views, all) })),
    recent: recent.results.map(r => ({ ...r, title: r.title.trim() || '제목 없는 원고' })),
  };
}

/** 평가 저장: 본인 원고이고 게시한 지 7일이 지난 것만. 다시 저장하면 고친다 */
export async function saveReview(db: D1Database, user: UserName, input: { draft_id: string; verdict: Verdict; note: string }, now = Date.now()) {
  const draft = await db.prepare("SELECT published_at FROM minilog_drafts WHERE user = ? AND id = ? AND status = 'published'").bind(user, input.draft_id).first<{ published_at: number | null }>();
  if (!draft || !draft.published_at) return '게시한 원고만 돌아볼 수 있어요.';
  if (draft.published_at > now - REVIEW.afterDays * DAY) return '게시하고 7일이 지나면 돌아볼 수 있어요.';
  const post = await db.prepare('SELECT MAX(views) AS views FROM minilog_posts WHERE user = ? AND draft_id = ?').bind(user, input.draft_id).first<{ views: number | null }>();
  await db.prepare('INSERT INTO minilog_reviews (user, draft_id, verdict, note, views, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user, draft_id) DO UPDATE SET verdict = excluded.verdict, note = excluded.note, views = excluded.views')
    .bind(user, input.draft_id, input.verdict, input.note, post?.views ?? null, now).run();
  return null;
}
