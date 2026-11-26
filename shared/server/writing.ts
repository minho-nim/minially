// 글쓰기 습관(계정 기반, 미니로그·미니허브 같이 씀): 자주 쓴 글 종류와 글 구조 설정.
// 자주 쓴 글 종류는 따로 세지 않고 원고(minilog_drafts.post_type)에서 센다 → 어느 기기에서 봐도 같다.
import type { D1Database } from './d1';
import type { UserName } from './auth';

/** 미니로그 글 종류 이름(mini-log/functions/_postTypes.ts의 label과 같아야 한다 — 시험으로 확인) */
export const TYPE_LABEL: Record<string, string> = { food: '맛집', cafe: '카페', product: '제품 리뷰', travel: '여행·나들이', sponsored: '체험단·협찬', beauty: '뷰티', fashion: '패션', info: '정보', daily: '일상' };
export const WRITING_STRUCTURES = ['basic', 'homefeed'] as const;
export type WritingStructure = typeof WRITING_STRUCTURES[number];
export const isWritingStructure = (v: unknown): v is WritingStructure => typeof v === 'string' && (WRITING_STRUCTURES as readonly string[]).includes(v);

export interface TypeUse { type: string; label: string; count: number }

/** 한 사람의 글 종류별 원고 수(많은 순, 고르지 않은 원고는 뺌) */
export async function typeUsage(db: D1Database, user: UserName): Promise<TypeUse[]> {
  const rows = (await db.prepare("SELECT post_type AS type, COUNT(*) AS count FROM minilog_drafts WHERE user = ? AND post_type IS NOT NULL AND post_type != 'none' GROUP BY post_type ORDER BY count DESC, post_type")
    .bind(user).all<{ type: string; count: number }>()).results;
  return rows.filter(r => r.type in TYPE_LABEL).map(r => ({ ...r, label: TYPE_LABEL[r.type] }));
}

/** 미니허브: 사람별 글 종류 원고 수(로그인한 사람만 보는 통합 화면용) */
export async function typeUsageAll(db: D1Database): Promise<(TypeUse & { user: string })[]> {
  const rows = (await db.prepare("SELECT user, post_type AS type, COUNT(*) AS count FROM minilog_drafts WHERE post_type IS NOT NULL AND post_type != 'none' GROUP BY user, post_type ORDER BY user, count DESC, post_type")
    .all<{ user: string; type: string; count: number }>()).results;
  return rows.filter(r => r.type in TYPE_LABEL).map(r => ({ ...r, label: TYPE_LABEL[r.type] }));
}

export async function getStructure(db: D1Database, user: UserName): Promise<WritingStructure> {
  const row = await db.prepare('SELECT structure FROM minilog_prefs WHERE user = ?').bind(user).first<{ structure: string }>();
  return isWritingStructure(row?.structure) ? row.structure : 'basic';
}

export async function setStructure(db: D1Database, user: UserName, structure: WritingStructure) {
  await db.prepare('INSERT INTO minilog_prefs (user, structure, updated_at) VALUES (?, ?, ?) ON CONFLICT(user) DO UPDATE SET structure = excluded.structure, updated_at = excluded.updated_at')
    .bind(user, structure, Date.now()).run();
}
