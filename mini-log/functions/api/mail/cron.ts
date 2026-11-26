import { json, type HubContext } from '../../../../shared/server/d1';
import { USERS, secretEquals } from '../../../../shared/server/auth';
import { ensureHubSchema } from '../../../../shared/server/schema';
import { syncMail } from '../../_mail';

// 자동 받기: GitHub Actions 예약 작업이 15분마다 부른다. Authorization: Bearer <MAIL_CRON_TOKEN>
// 숫자만 돌려준다(메일 내용·주소 없음). 같은 사람이 동시에 두 번 돌지 않게 syncMail이 잠근다.
export const onRequestPost = async ({ request, env }: HubContext) => {
  if (!env.DB || !env.MAIL_CRON_TOKEN) return json({ error: '자동 받기가 아직 설정되지 않았습니다.' }, 503);
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!given || !(await secretEquals(given, env.MAIL_CRON_TOKEN))) return json({ error: '권한이 없습니다.' }, 401);
  await ensureHubSchema(env.DB);
  const results: Record<string, { added: number; skipped?: string; failed?: boolean }> = {};
  for (const user of USERS) {
    const r = await syncMail(env.DB, env, user);
    results[user] = { added: r.added, ...(r.skipped ? { skipped: r.skipped } : {}), ...(r.error ? { failed: true } : {}) };
  }
  return json({ results });
};
