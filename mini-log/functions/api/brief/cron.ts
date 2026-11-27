import { json, type HubContext } from '../../../../shared/server/d1';
import { USERS, secretEquals } from '../../../../shared/server/auth';
import { ensureHubSchema } from '../../../../shared/server/schema';
import { morningPush } from '../../_brief';

// 아침 알림: GitHub Actions 예약 작업이 매일 아침 부른다. Authorization: Bearer <MAIL_CRON_TOKEN>(메일 자동 받기와 같은 토큰)
// 숫자만 돌려준다(할 일 내용·주소 없음). 같은 날 두 번 불러도 한 번만 보낸다.
export const onRequestPost = async ({ request, env }: HubContext) => {
  if (!env.DB || !env.MAIL_CRON_TOKEN) return json({ error: '자동 알림이 아직 설정되지 않았습니다.' }, 503);
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!given || !(await secretEquals(given, env.MAIL_CRON_TOKEN))) return json({ error: '권한이 없습니다.' }, 401);
  await ensureHubSchema(env.DB);
  return json(await morningPush(env.DB, env, USERS));
};
