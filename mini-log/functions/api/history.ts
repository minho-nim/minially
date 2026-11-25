import { json, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';
import { monthlyHistory, validMonth } from '../../../shared/server/report';
import { todayKst } from '../../../shared/server/revenue';

// 내 월별 내역(최근 12개월)·누적 합계. 미니허브는 같은 계산(monthlyHistory)으로 사람별로 견준다.
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const asked = new URL(ctx.request.url).searchParams.get('month');
  if (asked !== null && !validMonth(asked)) return json({ error: '달 형식이 올바르지 않아요(예: 2026-11).' }, 400);
  return json({ history: await monthlyHistory(auth.db, auth.session.user, asked ?? todayKst().slice(0, 7), 12) });
};
