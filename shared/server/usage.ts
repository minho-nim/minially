import type { D1Database, HubEnv } from './d1';
import { USERS, type UserName } from './auth';
import { geminiKey } from './ai';

/** 이번 달 1일 0시(UTC 기준)의 밀리초 */
export function monthStart(now = new Date()) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

export interface UsageRow { app: string; calls: number; errors: number; input_tokens: number; output_tokens: number }

/** 로그인한 사용자 본인의 사용량만(앱별) */
export async function userUsage(db: D1Database, user: UserName, since = monthStart()) {
  const rows = await db.prepare(
    "SELECT app, COUNT(*) AS calls, SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors, " +
      'COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens ' +
      'FROM ai_usage WHERE user = ? AND created_at >= ? GROUP BY app ORDER BY app',
  ).bind(user, since).all<UsageRow>();
  return rows.results;
}

export function geminiStatus(env: HubEnv, user: UserName) {
  return { connected: geminiKey(env, user) !== null };
}

/**
 * Minoffia 중앙 대시보드용 운영 통계. 숫자만 내보낸다
 * (키·원고·사진·협찬 계약 정보는 이 표에 없고, 내보내지도 않는다).
 */
export async function operationStats(db: D1Database, env: HubEnv, since: number) {
  const rows = await db.prepare(
    "SELECT user, app, model, task, COUNT(*) AS calls, SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors, " +
      'COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens ' +
      'FROM ai_usage WHERE created_at >= ? GROUP BY user, app, model, task ORDER BY user, app, model, task',
  ).bind(since).all<UsageRow & { user: string; model: string; task: string }>();
  const errors = await db.prepare(
    "SELECT app, error_code, COUNT(*) AS count FROM ai_usage WHERE created_at >= ? AND status = 'error' GROUP BY app, error_code ORDER BY app, error_code",
  ).bind(since).all<{ app: string; error_code: string; count: number }>();
  return {
    since: new Date(since).toISOString(),
    users: USERS.map(user => ({ user, gemini_connected: geminiKey(env, user) !== null })),
    usage: rows.results,
    errors: errors.results,
  };
}

/** 오늘(한국 시간 0시부터)의 시작 밀리초 */
export function kstDayStart(now = Date.now()) {
  const kst = new Date(now + 9 * 3600000);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600000;
}

export interface TodayRow { user: string; model: string; calls: number; limited: number }

/**
 * 오늘 사람·모델별 Gemini 호출 수와 한도 오류(rate_limited·quota_exceeded) 수.
 * 무료 등급 한도는 모델마다 하루 단위로 걸려서, 미니로그 초안·미니어리 사진 읽기가 같은 키를 나눠 쓸 때 얼마나 썼는지 본다.
 */
export async function todayUsage(db: D1Database, since = kstDayStart()) {
  const rows = await db.prepare(
    "SELECT user, model, COUNT(*) AS calls, SUM(CASE WHEN error_code IN ('rate_limited', 'quota_exceeded') THEN 1 ELSE 0 END) AS limited " +
      'FROM ai_usage WHERE created_at >= ? GROUP BY user, model ORDER BY user, calls DESC',
  ).bind(since).all<TodayRow>();
  return rows.results;
}

/** 이번 주(월요일 0시, 한국 시간)의 시작 밀리초 */
export function kstWeekStart(now = Date.now()) {
  const kst = new Date(now + 9 * 3600000);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - ((kst.getUTCDay() + 6) % 7)) - 9 * 3600000;
}
