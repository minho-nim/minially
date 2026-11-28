import type { D1Database, R2Bucket } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';

// 휴지통(지운 뒤 '되돌리기'): 원고·사진을 지우면 바로 목록에서 빠지지만, 행 내용을 10분 동안 휴지통에 둔다.
// 10분 안에 되돌리면 그대로 다시 넣고, 지나면 사진 파일(R2)까지 지운다. 본인 것만 다룬다.
export const TRASH_MS = 10 * 60 * 1000;
type Row = Record<string, unknown>;
const SAFE = /^[a-z][a-z0-9_]*$/;

const all = (db: D1Database, sql: string, ...v: unknown[]) => db.prepare(sql).bind(...v).all<Row>().then(r => r.results);
/** 우리 DB에서 읽은 행을 그대로 다시 넣는 문장(칸 이름은 소문자·숫자·_만) */
function insert(db: D1Database, table: string, row: Row) {
  const keys = Object.keys(row).filter(k => SAFE.test(k));
  return db.prepare(`INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).bind(...keys.map(k => row[k] ?? null));
}

/** 원고를 휴지통으로: 원고·사진·올린 곳·돌아보기 행을 담고 지운다(사진 파일은 그대로 둔다) */
export async function trashDraft(db: D1Database, user: UserName, id: string, now = Date.now()) {
  const draft = (await all(db, 'SELECT * FROM minilog_drafts WHERE user = ? AND id = ?', user, id))[0];
  if (!draft) return false;
  const [photos, shares, reviews, versions] = await Promise.all([
    all(db, 'SELECT * FROM minilog_photos WHERE user = ? AND draft_id = ?', user, id),
    all(db, 'SELECT * FROM minilog_shares WHERE user = ? AND draft_id = ?', user, id),
    all(db, 'SELECT * FROM minilog_reviews WHERE user = ? AND draft_id = ?', user, id),
    all(db, 'SELECT * FROM minilog_versions WHERE user = ? AND draft_id = ?', user, id),
  ]);
  await db.batch([
    db.prepare('INSERT OR REPLACE INTO minilog_trash (user, id, kind, data, deleted_at) VALUES (?, ?, ?, ?, ?)').bind(user, id, 'draft', JSON.stringify({ draft, photos, shares, reviews, versions }), now),
    db.prepare('DELETE FROM minilog_photos WHERE user = ? AND draft_id = ?').bind(user, id),
    db.prepare('DELETE FROM minilog_drafts WHERE user = ? AND id = ?').bind(user, id),
    db.prepare('DELETE FROM minilog_shares WHERE user = ? AND draft_id = ?').bind(user, id),
    db.prepare('DELETE FROM minilog_reviews WHERE user = ? AND draft_id = ?').bind(user, id),
    db.prepare('DELETE FROM minilog_versions WHERE user = ? AND draft_id = ?').bind(user, id),
  ]);
  return true;
}

/** 사진 한 장을 휴지통으로(파일은 그대로) */
export async function trashPhoto(db: D1Database, user: UserName, id: string, now = Date.now()) {
  const photo = (await all(db, 'SELECT * FROM minilog_photos WHERE user = ? AND id = ?', user, id))[0];
  if (!photo) return false;
  await db.batch([
    db.prepare('INSERT OR REPLACE INTO minilog_trash (user, id, kind, data, deleted_at) VALUES (?, ?, ?, ?, ?)').bind(user, id, 'photo', JSON.stringify({ photo }), now),
    db.prepare('DELETE FROM minilog_photos WHERE user = ? AND id = ?').bind(user, id),
  ]);
  return true;
}

/** 한 줄짜리(협찬 기록·해시태그 묶음·메일)를 휴지통으로. 표 이름은 정해 둔 것만 */
const ROW_TABLES = { campaign: 'minilog_campaigns', tagset: 'minilog_tag_sets', mail: 'minilog_mails' } as const;
export type RowKind = keyof typeof ROW_TABLES;
export async function trashRow(db: D1Database, user: UserName, kind: RowKind, id: string, now = Date.now()) {
  const table = ROW_TABLES[kind];
  const row = (await all(db, `SELECT * FROM ${table} WHERE user = ? AND id = ?`, user, id))[0];
  if (!row) return false;
  await db.batch([
    db.prepare('INSERT OR REPLACE INTO minilog_trash (user, id, kind, data, deleted_at) VALUES (?, ?, ?, ?, ?)').bind(user, id, kind, JSON.stringify({ row }), now),
    db.prepare(`DELETE FROM ${table} WHERE user = ? AND id = ?`).bind(user, id),
  ]);
  return true;
}

/** 되돌리기: 10분 안이면 담아 둔 행을 다시 넣는다. 사진은 그 원고가 아직 있을 때만 */
export async function restoreTrash(db: D1Database, user: UserName, id: string, now = Date.now()): Promise<'draft' | 'photo' | RowKind | 'expired' | 'missing'> {
  const t = await db.prepare('SELECT kind, data, deleted_at FROM minilog_trash WHERE user = ? AND id = ?').bind(user, id).first<{ kind: string; data: string; deleted_at: number }>();
  if (!t) return 'missing';
  if (t.deleted_at < now - TRASH_MS) return 'expired';
  const data = JSON.parse(t.data) as { draft?: Row; photos?: Row[]; shares?: Row[]; reviews?: Row[]; versions?: Row[]; photo?: Row; row?: Row };
  const own = (r: Row) => r.user === user; // 다른 사람 행이 섞이지 않게 한 번 더
  if (t.kind in ROW_TABLES) {
    const kind = t.kind as RowKind;
    if (!data.row || !own(data.row)) return 'missing';
    await db.batch([insert(db, ROW_TABLES[kind], data.row), db.prepare('DELETE FROM minilog_trash WHERE user = ? AND id = ?').bind(user, id)]);
    return kind;
  }
  if (t.kind === 'photo') {
    if (!data.photo || !own(data.photo)) return 'missing';
    if (!(await db.prepare('SELECT 1 AS ok FROM minilog_drafts WHERE user = ? AND id = ?').bind(user, data.photo.draft_id).first())) return 'missing';
    await db.batch([insert(db, 'minilog_photos', data.photo), db.prepare('DELETE FROM minilog_trash WHERE user = ? AND id = ?').bind(user, id)]);
    return 'photo';
  }
  if (!data.draft || !own(data.draft)) return 'missing';
  await db.batch([
    insert(db, 'minilog_drafts', data.draft),
    ...(data.photos ?? []).filter(own).map(r => insert(db, 'minilog_photos', r)),
    ...(data.shares ?? []).filter(own).map(r => insert(db, 'minilog_shares', r)),
    ...(data.reviews ?? []).filter(own).map(r => insert(db, 'minilog_reviews', r)),
    ...(data.versions ?? []).filter(own).map(r => insert(db, 'minilog_versions', r)),
    db.prepare('DELETE FROM minilog_trash WHERE user = ? AND id = ?').bind(user, id),
  ]);
  return 'draft';
}

/** 10분 지난 휴지통 비우기: 사진 파일까지 지운다(원고 목록을 열 때·지울 때 그 사람 것만) */
export async function purgeTrash(db: D1Database, bucket: R2Bucket | undefined, user: UserName, now = Date.now()) {
  const old = (await db.prepare('SELECT id, data FROM minilog_trash WHERE user = ? AND deleted_at < ? LIMIT 50').bind(user, now - TRASH_MS).all<{ id: string; data: string }>()).results;
  if (!old.length) return 0;
  const keys: string[] = [];
  for (const t of old) {
    try {
      const d = JSON.parse(t.data) as { photos?: Row[]; photo?: Row };
      for (const r of [...(d.photos ?? []), ...(d.photo ? [d.photo] : [])]) if (typeof r.r2_key === 'string') keys.push(r.r2_key);
    } catch { /* 깨진 행은 그냥 지운다 */ }
  }
  if (bucket && keys.length) await bucket.delete(keys);
  await db.batch(old.map(t => db.prepare('DELETE FROM minilog_trash WHERE user = ? AND id = ?').bind(user, t.id)));
  return old.length;
}
