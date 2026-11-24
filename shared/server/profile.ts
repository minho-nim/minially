import type { D1Database } from './d1';
import { USERS, type UserName } from './auth';

// 사용자 설정: 화면에 보여 줄 이름(기본 '사용자 C')과 화면 테마(auto·light·dark). 로그인 코드와는 상관없다.
export const THEMES = ['auto', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export interface Profile { name: string; theme: Theme }
export const defaultName = (user: string) => `사용자 ${user}`;

/** 이름: 앞뒤 공백 제거, 1~20자, 제어 문자·꺾쇠 없이 */
export function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim();
  if (!name || [...name].length > 20 || /[\u0000-\u001f<>]/.test(name)) return null;
  return name;
}

export async function profiles(db: D1Database): Promise<Record<UserName, Profile>> {
  const rows = (await db.prepare('SELECT user, name, theme FROM hub_profiles').all<{ user: UserName; name: string; theme: Theme }>()).results;
  return Object.fromEntries(USERS.map(u => {
    const r = rows.find(x => x.user === u);
    return [u, { name: r?.name || defaultName(u), theme: THEMES.includes(r?.theme as Theme) ? (r!.theme) : 'auto' }];
  })) as Record<UserName, Profile>;
}

export async function saveProfile(db: D1Database, user: UserName, patch: Partial<Profile>) {
  const current = (await profiles(db))[user];
  const next = { ...current, ...patch };
  await db.prepare('INSERT INTO hub_profiles (user, name, theme, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user) DO UPDATE SET name = excluded.name, theme = excluded.theme, updated_at = excluded.updated_at')
    .bind(user, next.name, next.theme, Date.now()).run();
  return next;
}
