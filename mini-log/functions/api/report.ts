import { json, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';
import { monthlyReport, validMonth } from '../../../shared/server/report';
import { todayKst } from '../../../shared/server/revenue';

// 내 월간 보고: GET ?month=YYYY-MM (없으면 이번 달)
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const asked = new URL(ctx.request.url).searchParams.get('month');
  if (asked !== null && !validMonth(asked)) return json({ error: '달 형식이 올바르지 않아요(예: 2026-11).' }, 400);
  return json({ report: await monthlyReport(auth.db, auth.session.user, asked ?? todayKst().slice(0, 7)) });
};
