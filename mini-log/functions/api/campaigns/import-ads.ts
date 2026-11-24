import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';

// 광고 수익 가져오기: POST { source: 'adsense'|'adpost'|'other', months: [{ month: 'YYYY-MM', amount }] }
// 달마다 '광고' 수익 기록 하나(받은 날 = 그달 말일). 같은 출처·같은 달을 다시 올리면 새로 만들지 않고 금액을 바꾼다(memo에 표식).
const LABEL = { adsense: '애드센스', adpost: '애드포스트', other: '기타 광고' } as const;
type Source = keyof typeof LABEL;
const lastDay = (month: string) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session: { user } } = auth;
  const body = await readJson(ctx.request);
  const source = body?.source as Source;
  if (!(source in LABEL)) return json({ error: '광고 종류가 올바르지 않아요.' }, 400);
  const months = Array.isArray(body?.months) ? body!.months as { month: unknown; amount: unknown }[] : [];
  if (!months.length || months.length > 120) return json({ error: '가져올 달이 없거나 너무 많아요(최대 120달).' }, 400);
  for (const m of months) {
    if (typeof m?.month !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(m.month) || !Number.isSafeInteger(m.amount) || (m.amount as number) < 0 || (m.amount as number) > 10_000_000_000) return json({ error: '달 또는 금액 형식이 올바르지 않아요.' }, 400);
  }
  const now = Date.now();
  let added = 0, updated = 0;
  for (const m of months as { month: string; amount: number }[]) {
    const mark = `import:${source}:${m.month}`;
    const existing = await db.prepare("SELECT id FROM minilog_campaigns WHERE user = ? AND kind = 'ad' AND memo = ?").bind(user, mark).first<{ id: string }>();
    if (existing) {
      await db.prepare('UPDATE minilog_campaigns SET amount = ?, paid_on = ?, status = ?, updated_at = ? WHERE id = ? AND user = ?').bind(m.amount, lastDay(m.month), 'paid', now, existing.id, user).run();
      updated++;
    } else {
      await db.prepare("INSERT INTO minilog_campaigns (id, user, kind, brand, title, provided, amount, deadline, status, paid_on, draft_id, memo, created_at, updated_at) VALUES (?, ?, 'ad', ?, ?, '', ?, NULL, 'paid', ?, NULL, ?, ?, ?)")
        .bind(crypto.randomUUID(), user, LABEL[source], `${Number(m.month.slice(5))}월 ${LABEL[source]} 수익`, m.amount, lastDay(m.month), mark, now, now).run();
      added++;
    }
  }
  return json({ added, updated });
};
