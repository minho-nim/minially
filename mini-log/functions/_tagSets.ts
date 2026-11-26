import type { D1Database } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';
import { cleanHashtags } from './_drafts';

// 해시태그 묶음(Later·Planoly의 저장한 해시태그처럼): 자주 쓰는 태그를 이름 붙여 두고 원고에 한 번에 넣는다.
export const TAG_SETS = { max: 20, name: 20 };
export interface TagSet { id: string; name: string; tags: string[]; created_at: number }

/** { name, tags } 검사 → 값 또는 오류 문구 */
export function readTagSet(body: Record<string, unknown> | null): { name: string; tags: string[] } | string {
  if (!body) return 'JSON 형식이 아닙니다.';
  const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
  if (!name) return '묶음 이름을 적어 주세요.';
  if (name.length > TAG_SETS.name) return `묶음 이름은 ${TAG_SETS.name}자까지예요.`;
  const tags = cleanHashtags(body.tags);
  if (!tags || !tags.length) return '태그를 하나 이상 넣어 주세요.';
  return { name, tags };
}

export async function listTagSets(db: D1Database, user: UserName): Promise<TagSet[]> {
  const rows = (await db.prepare('SELECT id, name, tags, created_at FROM minilog_tag_sets WHERE user = ? ORDER BY created_at, id').bind(user).all<{ id: string; name: string; tags: string; created_at: number }>()).results;
  return rows.map(r => ({ ...r, tags: r.tags.split('\n').filter(Boolean) }));
}

/** 같은 이름이 있으면 태그를 바꾸고, 없으면 새로 만든다 */
export async function saveTagSet(db: D1Database, user: UserName, set: { name: string; tags: string[] }, now = Date.now()) {
  const same = await db.prepare('SELECT id FROM minilog_tag_sets WHERE user = ? AND name = ?').bind(user, set.name).first<{ id: string }>();
  if (same) { await db.prepare('UPDATE minilog_tag_sets SET tags = ? WHERE user = ? AND id = ?').bind(set.tags.join('\n'), user, same.id).run(); return null; }
  const n = (await db.prepare('SELECT COUNT(*) AS n FROM minilog_tag_sets WHERE user = ?').bind(user).first<{ n: number }>())?.n ?? 0;
  if (n >= TAG_SETS.max) return `해시태그 묶음은 ${TAG_SETS.max}개까지예요. 안 쓰는 묶음을 지워 주세요.`;
  await db.prepare('INSERT INTO minilog_tag_sets (id, user, name, tags, created_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), user, set.name, set.tags.join('\n'), now).run();
  return null;
}

export async function deleteTagSet(db: D1Database, user: UserName, id: string) {
  if (!(await db.prepare('SELECT 1 AS ok FROM minilog_tag_sets WHERE user = ? AND id = ?').bind(user, id).first())) return false;
  await db.prepare('DELETE FROM minilog_tag_sets WHERE user = ? AND id = ?').bind(user, id).run();
  return true;
}
