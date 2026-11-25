import { json, type HubContext } from '../../../shared/server/d1';
import { secretEquals } from '../../../shared/server/auth';
import { ensureHubSchema } from '../../../shared/server/schema';
import { monthStart, operationStats } from '../../../shared/server/usage';

// Minoffia 중앙 대시보드용 운영 통계(숫자만). Authorization: Bearer <STATS_API_TOKEN>
// ?since=2026-11-01 처럼 시작일을 줄 수 있다(없으면 이번 달).
export const onRequestGet = async ({ request, env }: HubContext) => {
  if (!env.DB || !env.STATS_API_TOKEN) return json({ error: '통계 API가 아직 설정되지 않았습니다.' }, 503);
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  // 길이·내용이 달라도 같은 시간이 걸리도록 해시끼리 한 글자씩 모두 비교한다.
  if (!given || !(await secretEquals(given, env.STATS_API_TOKEN))) return json({ error: '권한이 없습니다.' }, 401);
  const sinceParam = new URL(request.url).searchParams.get('since');
  const since = sinceParam ? Date.parse(sinceParam) : monthStart();
  if (!Number.isFinite(since)) return json({ error: 'since 날짜 형식이 올바르지 않습니다.' }, 400);
  await ensureHubSchema(env.DB);
  return json(await operationStats(env.DB, env, since));
};
