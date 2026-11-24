import { json, type HubContext } from '../../../shared/server/d1';
import { requireSession, USERS } from '../../../shared/server/auth';
import { monthlyReport, validMonth } from '../../../shared/server/report';
import { todayKst } from '../../../shared/server/revenue';

// 통합 월간 보고: C·D 각각의 보고(합계·비교는 화면에서). 통합 대시보드처럼 로그인한 사람은 두 사람 숫자를 본다.
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'hub');
  if (auth instanceof Response) return auth;
  const asked = new URL(ctx.request.url).searchParams.get('month');
  if (asked !== null && !validMonth(asked)) return json({ error: '달 형식이 올바르지 않아요(예: 2026-11).' }, 400);
  const month = asked ?? todayKst().slice(0, 7);
  return json({ month, reports: await Promise.all(USERS.map(user => monthlyReport(auth.db, user, month))) });
};
