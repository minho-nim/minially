// 미니로그 원고 저장(D1 minilog_drafts). 모든 쿼리는 로그인한 사용자(user) 조건을 붙여 남의 원고를 못 보게 한다.
import type { D1Database } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';

export interface Draft {
  id: string; title: string; body: string; hashtags: string[]; experience: string;
  status: 'draft' | 'approved'; created_at: number; updated_at: number;
}
interface Row extends Omit<Draft, 'hashtags'> { hashtags: string }

export const LIMITS = { title: 200, body: 50000, experience: 5000, hashtags: 30, hashtag: 40 };

const toDraft = (row: Row): Draft => ({ ...row, hashtags: row.hashtags ? row.hashtags.split('\n').filter(Boolean) : [] });

export function cleanHashtags(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const tags = value.filter((t): t is string => typeof t === 'string')
    .map(t => t.replace(/^#+/, '').replace(/[\s\n]+/g, '').slice(0, LIMITS.hashtag))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, LIMITS.hashtags);
}

/** 사용자가 보낸 값 중 고칠 수 있는 칸만 골라 검사한다. 틀리면 오류 문구를 돌려준다. */
export function readPatch(body: Record<string, unknown>): Partial<Pick<Draft, 'title' | 'body' | 'experience' | 'hashtags' | 'status'>> | string {
  const patch: Partial<Pick<Draft, 'title' | 'body' | 'experience' | 'hashtags' | 'status'>> = {};
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
    if (body.status !== 'draft' && body.status !== 'approved') return '알 수 없는 상태예요.';
    patch.status = body.status;
  }
  return patch;
}

export async function listDrafts(db: D1Database, user: UserName) {
  const rows = await db.prepare('SELECT id, title, body, hashtags, experience, status, created_at, updated_at FROM minilog_drafts WHERE user = ? ORDER BY updated_at DESC LIMIT 200').bind(user).all<Row>();
  return rows.results.map(toDraft);
}

export async function getDraft(db: D1Database, user: UserName, id: string) {
  const row = await db.prepare('SELECT id, title, body, hashtags, experience, status, created_at, updated_at FROM minilog_drafts WHERE user = ? AND id = ?').bind(user, id).first<Row>();
  return row ? toDraft(row) : null;
}

export async function createDraft(db: D1Database, user: UserName) {
  const now = Date.now();
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO minilog_drafts (id, user, created_at, updated_at) VALUES (?, ?, ?, ?)').bind(id, user, now, now).run();
  return (await getDraft(db, user, id))!;
}

export async function updateDraft(db: D1Database, user: UserName, id: string, patch: ReturnType<typeof readPatch> & object) {
  const current = await getDraft(db, user, id);
  if (!current) return null;
  const next = { ...current, ...patch };
  await db.prepare('UPDATE minilog_drafts SET title = ?, body = ?, hashtags = ?, experience = ?, status = ?, updated_at = ? WHERE user = ? AND id = ?')
    .bind(next.title, next.body, next.hashtags.join('\n'), next.experience, next.status, Date.now(), user, id).run();
  return getDraft(db, user, id);
}

export async function deleteDraft(db: D1Database, user: UserName, id: string) {
  await db.prepare('DELETE FROM minilog_drafts WHERE user = ? AND id = ?').bind(user, id).run();
}
