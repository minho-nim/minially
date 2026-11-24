import { json, readJson, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';

// 한 달 수익 목표: PUT { monthly: 원 | null } (null이면 지움). 대시보드가 받은 금액과 견줘 보여 준다.
export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const body = await readJson(ctx.request);
  const { db, session: { user } } = auth;
  if (body?.monthly === null) {
    await db.prepare('DELETE FROM minilog_goals WHERE user = ?').bind(user).run();
    return json({ monthly: null });
  }
  const monthly = Number(body?.monthly);
  if (!Number.isSafeInteger(monthly) || monthly < 1000 || monthly > 10_000_000_000) return json({ error: '목표는 1,000원 이상 숫자로 적어 주세요.' }, 400);
  await db.prepare('INSERT INTO minilog_goals (user, monthly, updated_at) VALUES (?, ?, ?) ON CONFLICT(user) DO UPDATE SET monthly = excluded.monthly, updated_at = excluded.updated_at').bind(user, monthly, Date.now()).run();
  return json({ monthly });
};
