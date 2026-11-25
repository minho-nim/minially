import { json, type HubContext } from '../../../shared/server/d1';
import { requireSession, USERS } from '../../../shared/server/auth';
import { monthlyHistory, validMonth } from '../../../shared/server/report';
import { todayKst } from '../../../shared/server/revenue';

// 사람별 월별 내역(최근 12개월)·누적 합계: 미니로그가 각자 보는 숫자와 같은 계산으로 C·D를 견준다(숫자만).
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'hub');
  if (auth instanceof Response) return auth;
  const asked = new URL(ctx.request.url).searchParams.get('month');
  if (asked !== null && !validMonth(asked)) return json({ error: '달 형식이 올바르지 않아요(예: 2026-11).' }, 400);
  const month = asked ?? todayKst().slice(0, 7);
  return json({ month, histories: await Promise.all(USERS.map(user => monthlyHistory(auth.db, user, month, 12))) });
};
