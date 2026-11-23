// 미니로그 사진: 파일은 R2(MINILOG_PHOTOS), 정보는 D1 minilog_photos. 모든 쿼리에 user 조건을 붙인다.
import type { D1Database, R2Bucket } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';

export interface Photo { id: string; draft_id: string; name: string; content_type: string; size: number; position: number; created_at: number; expires_at: number | null }

export const PHOTO_LIMITS = { bytes: 5 * 1024 * 1024, perDraft: 20, forAi: 8, name: 120 };
const COLUMNS = 'id, draft_id, name, content_type, size, position, created_at, expires_at';

/** 파일 앞부분(매직 바이트)으로 형식을 확인한다. 보낸 쪽이 적은 content-type은 믿지 않는다. */
export function sniffImage(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export function cleanName(value: string | null) {
  let name = '';
  try { name = decodeURIComponent(value ?? ''); } catch { name = ''; }
  name = name.replace(/[\u0000-\u001f\\/]/g, '').trim().slice(0, PHOTO_LIMITS.name);
  return name || '사진';
}

export async function listPhotos(db: D1Database, user: UserName, draftId: string) {
  return (await db.prepare(`SELECT ${COLUMNS} FROM minilog_photos WHERE user = ? AND draft_id = ? ORDER BY position, created_at`).bind(user, draftId).all<Photo>()).results;
}

export async function getPhoto(db: D1Database, user: UserName, id: string) {
  return db.prepare(`SELECT ${COLUMNS}, r2_key FROM minilog_photos WHERE user = ? AND id = ?`).bind(user, id).first<Photo & { r2_key: string }>();
}

export async function addPhoto(db: D1Database, bucket: R2Bucket, user: UserName, draftId: string, bytes: Uint8Array, contentType: string, name: string, expiresAt: number | null) {
  const id = crypto.randomUUID();
  const key = `${user}/${draftId}/${id}`;
  const position = ((await db.prepare('SELECT COALESCE(MAX(position), -1) AS p FROM minilog_photos WHERE user = ? AND draft_id = ?').bind(user, draftId).first<{ p: number }>())?.p ?? -1) + 1;
  await bucket.put(key, bytes, { httpMetadata: { contentType } });
  try {
    await db.prepare('INSERT INTO minilog_photos (id, user, draft_id, r2_key, name, content_type, size, position, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, user, draftId, key, name, contentType, bytes.byteLength, position, Date.now(), expiresAt).run();
  } catch (error) {
    await bucket.delete(key); // 정보 저장이 실패하면 파일도 지워 고아 파일을 남기지 않는다
    throw error;
  }
  return (await getPhoto(db, user, id))!;
}

export async function deletePhotos(db: D1Database, bucket: R2Bucket | undefined, rows: { id: string; r2_key: string }[], user: UserName) {
  if (rows.length === 0) return;
  if (bucket) await bucket.delete(rows.map(r => r.r2_key));
  await db.batch(rows.map(r => db.prepare('DELETE FROM minilog_photos WHERE user = ? AND id = ?').bind(user, r.id)));
}

export async function deleteDraftPhotos(db: D1Database, bucket: R2Bucket | undefined, user: UserName, draftId: string) {
  const rows = (await db.prepare('SELECT id, r2_key FROM minilog_photos WHERE user = ? AND draft_id = ?').bind(user, draftId).all<{ id: string; r2_key: string }>()).results;
  await deletePhotos(db, bucket, rows, user);
}

/**
 * 게시 후 30일이 지난 사진을 지운다. 사용자가 원고 목록을 열 때 그 사용자 것만 정리한다.
 * shortcut: Pages Functions에는 정해진 시각에 도는 작업이 없어 목록을 열 때 정리한다. 오래 안 열면 늦게 지워진다. 별도 Worker 크론이 생기면 옮긴다.
 */
export async function cleanupExpired(db: D1Database, bucket: R2Bucket | undefined, user: UserName, now = Date.now()) {
  const rows = (await db.prepare('SELECT id, r2_key FROM minilog_photos WHERE user = ? AND expires_at IS NOT NULL AND expires_at <= ? LIMIT 200').bind(user, now).all<{ id: string; r2_key: string }>()).results;
  await deletePhotos(db, bucket, rows, user);
  return rows.length;
}

/** 큰 바이트 배열을 base64로(한 번에 String.fromCharCode를 하면 스택이 넘친다) */
export function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
