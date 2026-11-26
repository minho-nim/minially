// 게시 시간표(Buffer의 게시 칸을 사람이 올리는 방식으로): 주간 게시 요일과, 고른 글감을 빈 게시일에 나눠 원고로 만들기.
// 날짜만 잡아 두고 게시는 사람이 한다(자동 게시 없음).
import type { D1Database } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';

export const MAX_PLAN = 12;
export const PLAN_DAYS = 56; // 앞으로 8주 안에서만 날짜를 잡는다

/** 요일 목록 검사: 0(일)~6(토) 정수, 겹침 없이 1~7개. 이상하면 null */
export function readDays(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 7) return null;
  if (!value.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) return null;
  const days = [...new Set(value as number[])].sort();
  return days.length === value.length ? days : null;
}

export async function getRhythm(db: D1Database, user: UserName): Promise<number[]> {
  const row = await db.prepare('SELECT days FROM minilog_rhythm WHERE user = ?').bind(user).first<{ days: string }>();
  return row ? (readDays(JSON.parse(row.days)) ?? []) : [];
}

export async function setRhythm(db: D1Database, user: UserName, days: number[]) {
  await db.prepare('INSERT INTO minilog_rhythm (user, days, updated_at) VALUES (?, ?, ?) ON CONFLICT(user) DO UPDATE SET days = excluded.days, updated_at = excluded.updated_at')
    .bind(user, JSON.stringify(days), Date.now()).run();
}

const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** 오늘부터 8주 안에서 게시 요일이고 아직 원고가 잡히지 않은 날을 count개 차례로 고른다. 모자라면 그만큼 null */
export function freeSlots(today: string, days: number[], taken: Set<string>, count: number): (string | null)[] {
  const slots: string[] = [];
  for (let i = 0; i < PLAN_DAYS && slots.length < count; i++) {
    const day = shift(today, i);
    if (days.includes(new Date(`${day}T00:00:00Z`).getUTCDay()) && !taken.has(day)) slots.push(day);
  }
  return Array.from({ length: count }, (_, i) => slots[i] ?? null);
}
