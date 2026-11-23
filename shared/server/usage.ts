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
    // shortcut: 추정 비용은 모델 단가가 자주 바뀌어 아직 계산하지 않는다. 단가 표를 정하면 토큰에 곱해 채운다.
    estimated_cost_usd: null,
  };
}
