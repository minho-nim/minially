// 미니로그 원고 저장(D1 minilog_drafts). 모든 쿼리는 로그인한 사용자(user) 조건을 붙여 남의 원고를 못 보게 한다.
import type { D1Database } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';

export type DraftStatus = 'draft' | 'approved' | 'published';
export interface Draft {
  id: string; title: string; body: string; hashtags: string[]; experience: string;
  status: DraftStatus; published_url: string; published_at: number | null; style_id: string; planned_on: string | null; created_at: number; updated_at: number;
}
interface Row extends Omit<Draft, 'hashtags'> { hashtags: string }

export const LIMITS = { title: 200, body: 50000, experience: 5000, hashtags: 30, hashtag: 40, url: 500 };

const COLUMNS = 'id, title, body, hashtags, experience, status, published_url, published_at, style_id, planned_on, created_at, updated_at';

const toDraft = (row: Row): Draft => ({ ...row, hashtags: row.hashtags ? row.hashtags.split('\n').filter(Boolean) : [] });

export function cleanHashtags(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const tags = value.filter((t): t is string => typeof t === 'string')
    .map(t => t.replace(/^#+/, '').replace(/[\s\n]+/g, '').slice(0, LIMITS.hashtag))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, LIMITS.hashtags);
}

/** 사용자가 보낸 값 중 고칠 수 있는 칸만 골라 검사한다. 틀리면 오류 문구를 돌려준다. */
type Patch = Partial<Pick<Draft, 'title' | 'body' | 'experience' | 'hashtags' | 'status' | 'published_url' | 'style_id' | 'planned_on'>>;

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** 게시 주소: http(s) 주소만 받는다(자바스크립트 주소 등은 거절). */
export function cleanUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length > LIMITS.url) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function readPatch(body: Record<string, unknown>): Patch | string {
  const patch: Patch = {};
  for (const key of ['title', 'body', 'experience'] as const) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'string') return '글자만 저장할 수 있어요.';
    if ((body[key] as string).length > LIMITS[key]) return '내용이 너무 길어요.';
    patch[key] = body[key] as string;
  }
  if (body.hashtags !== undefined) {
    const tags = cleanHashtags(body.hashtags);
    if (!tags) return '해시태그 형식이 올바르지 않아요.';
    patch.hashtags = tags;
  }
  if (body.status !== undefined) {
    if (body.status !== 'draft' && body.status !== 'approved' && body.status !== 'published') return '알 수 없는 상태예요.';
    patch.status = body.status;
  }
  if (body.planned_on !== undefined) {
    if (body.planned_on === null || body.planned_on === '') patch.planned_on = null;
    else if (typeof body.planned_on === 'string' && validDate(body.planned_on)) patch.planned_on = body.planned_on;
    else return '게시 예정일 형식이 올바르지 않아요.';
  }
  if (body.style_id !== undefined) {
    if (typeof body.style_id !== 'string' || !/^(mine|none|[0-9a-f-]{36})$/.test(body.style_id)) return '문체 선택이 올바르지 않아요.';
    patch.style_id = body.style_id;
  }
  if (body.published_url !== undefined) {
    if (typeof body.published_url !== 'string') return '게시 주소 형식이 올바르지 않아요.';
    const url = cleanUrl(body.published_url);
    if (url === null) return '게시 주소는 https://로 시작하는 주소여야 해요.';
    patch.published_url = url;
  }
  return patch;
}

export async function listDrafts(db: D1Database, user: UserName) {
  const rows = await db.prepare(`SELECT ${COLUMNS} FROM minilog_drafts WHERE user = ? ORDER BY updated_at DESC LIMIT 200`).bind(user).all<Row>();
  return rows.results.map(toDraft);
}

export async function getDraft(db: D1Database, user: UserName, id: string) {
  const row = await db.prepare(`SELECT ${COLUMNS} FROM minilog_drafts WHERE user = ? AND id = ?`).bind(user, id).first<Row>();
  return row ? toDraft(row) : null;
}

export async function createDraft(db: D1Database, user: UserName, plannedOn: string | null = null) {
  const now = Date.now();
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO minilog_drafts (id, user, planned_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(id, user, plannedOn, now, now).run();
  return (await getDraft(db, user, id))!;
}

export const PHOTO_KEEP_DAYS = 30;

/**
 * 원고 고치기. 게시 완료(published)로 바꾸면 게시 주소가 있어야 하고, 그 원고의 사진은 30일 뒤 지워지도록 표시한다.
 * 게시를 취소하면 삭제 예정도 취소한다.
 */
/** 다른 기기에서 먼저 바뀐 원고에 예전 기준으로 글을 고쳐 저장하려 할 때: 내 내용을 사본 원고로 남긴다(원본은 그대로) */
export async function saveConflictCopy(db: D1Database, user: UserName, current: Draft, patch: Patch): Promise<Draft> {
  const copy = await createDraft(db, user, current.planned_on);
  const mine = { ...current, ...patch };
  const saved = await updateDraft(db, user, copy.id, { title: `${(mine.title || '제목 없는 원고').slice(0, LIMITS.title - 20)} · 다른 기기 수정 사본`, body: mine.body, experience: mine.experience, hashtags: mine.hashtags, style_id: mine.style_id });
  return typeof saved === 'object' && saved ? saved : copy;
}

export async function updateDraft(db: D1Database, user: UserName, id: string, patch: Patch): Promise<Draft | null | string> {
  const current = await getDraft(db, user, id);
  if (!current) return null;
  const next = { ...current, ...patch };
  if (next.status === 'published' && !next.published_url) return '게시 완료하려면 게시한 글 주소를 넣어 주세요.';
  const now = Date.now();
  const becamePublished = next.status === 'published' && current.status !== 'published';
  const leftPublished = next.status !== 'published' && current.status === 'published';
  const publishedAt = becamePublished ? now : leftPublished ? null : current.published_at;
  const statements = [
    db.prepare('UPDATE minilog_drafts SET title = ?, body = ?, hashtags = ?, experience = ?, status = ?, published_url = ?, published_at = ?, style_id = ?, planned_on = ?, updated_at = ? WHERE user = ? AND id = ?')
      .bind(next.title, next.body, next.hashtags.join('\n'), next.experience, next.status, next.published_url, publishedAt, next.style_id, next.planned_on, now, user, id),
  ];
  if (becamePublished) statements.push(db.prepare('UPDATE minilog_photos SET expires_at = ? WHERE user = ? AND draft_id = ?').bind(now + PHOTO_KEEP_DAYS * 86400000, user, id));
  if (leftPublished) statements.push(db.prepare('UPDATE minilog_photos SET expires_at = NULL WHERE user = ? AND draft_id = ?').bind(user, id));
  await db.batch(statements);
  return getDraft(db, user, id);
}

export async function deleteDraft(db: D1Database, user: UserName, id: string) {
  await db.prepare('DELETE FROM minilog_drafts WHERE user = ? AND id = ?').bind(user, id).run();
}
