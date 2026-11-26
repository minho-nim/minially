import { json, readJson, type HubContext } from '../../../shared/server/d1';
import { requireSession } from '../../../shared/server/auth';
import { createDraft, readPatch, updateDraft } from '../_drafts';
import { kstDay } from '../_ideas';
import { MAX_PLAN, freeSlots, getRhythm, readDays, setRhythm } from '../_plan';

// GET: 게시 요일 · PUT { days }: 게시 요일 저장 · POST { items: [{ title, hashtags }] }: 고른 글감을 빈 게시일에 원고로(준 순서대로 빠른 날부터)
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  return json({ days: await getRhythm(auth.db, auth.session.user) });
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const days = readDays((await readJson(ctx.request))?.days);
  if (!days) return json({ error: '게시 요일을 하나 이상 골라 주세요.' }, 400);
  await setRhythm(auth.db, auth.session.user, days);
  return json({ days });
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session: { user } } = auth;
  const items = (await readJson(ctx.request))?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_PLAN) return json({ error: `글감을 1~${MAX_PLAN}개 골라 주세요.` }, 400);
  const patches = [];
  for (const item of items) {
    const patch = readPatch({ title: (item as Record<string, unknown>)?.title, hashtags: (item as Record<string, unknown>)?.hashtags ?? [] });
    if (typeof patch === 'string' || !patch.title?.trim()) return json({ error: typeof patch === 'string' ? patch : '제목이 빈 글감이 있어요.' }, 400);
    patches.push(patch);
  }
  const days = await getRhythm(db, user);
  if (!days.length) return json({ error: '먼저 게시 요일을 골라 주세요.' }, 400);
  const today = kstDay();
  const taken = new Set((await db.prepare('SELECT planned_on FROM minilog_drafts WHERE user = ? AND planned_on >= ?').bind(user, today).all<{ planned_on: string }>()).results.map(r => r.planned_on));
  const slots = freeSlots(today, days, taken, patches.length);
  const drafts = [];
  for (let i = 0; i < patches.length; i++) {
    const draft = await createDraft(db, user, slots[i]);
    const updated = await updateDraft(db, user, draft.id, patches[i]);
    drafts.push({ ...(updated && typeof updated !== 'string' ? updated : draft), photo_count: 0 });
  }
  return json({ drafts, unplaced: slots.filter(s => !s).length }, 201);
};
