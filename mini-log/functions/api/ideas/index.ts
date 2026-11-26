import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { AiError, callGemini } from '../../../../shared/server/ai';
import { ideasPrompt, kstDay, listWatch, myMaterial, readIdeas, upcomingSeasons } from '../../_ideas';
import { getBlog } from '../../_blog';
import { forecastDemand } from '../../_demand';
import { getRhythm } from '../../_plan';

// GET: 다가오는 시기·참고 블로그·마지막 추천·다음 4주 수요 예측(내 글 기준, AI 없음)·게시 요일 · POST { search?: boolean }: 글감 새로 추천받기
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session: { user } } = auth;
  const last = await db.prepare('SELECT ideas, used_search, created_at FROM minilog_ideas WHERE user = ?').bind(user).first<{ ideas: string; used_search: number; created_at: number }>();
  const today = kstDay();
  return json({
    seasons: upcomingSeasons(today),
    demand: forecastDemand((await getBlog(db, user)).posts, today),
    rhythm: await getRhythm(db, user),
    watch: await listWatch(db, user),
    last: last ? { ideas: JSON.parse(last.ideas), used_search: !!last.used_search, created_at: last.created_at } : null,
  });
};

export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session: { user } } = auth;
  const search = (await readJson(ctx.request))?.search === true;
  const [watch, mine] = await Promise.all([listWatch(db, user), myMaterial(db, user)]);
  let text: string;
  try {
    ({ text } = await callGemini({ env: ctx.env, db, user, app: 'minilog', task: search ? 'ideas_search' : 'ideas', prompt: ideasPrompt({ today: kstDay(), seasons: upcomingSeasons(kstDay()), watch, mine, search, count: 8 }), json: !search, search }));
  } catch (error) {
    if (error instanceof AiError) return json({ error: error.message, code: error.code }, error.status);
    throw error;
  }
  const ideas = readIdeas(text);
  if (ideas.length === 0) return json({ error: 'AI 답에서 글감을 읽지 못했어요. 다시 시도해 주세요.', code: 'bad_response' }, 502);
  const now = Date.now();
  await db.prepare('INSERT INTO minilog_ideas (user, ideas, used_search, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(user) DO UPDATE SET ideas = excluded.ideas, used_search = excluded.used_search, created_at = excluded.created_at')
    .bind(user, JSON.stringify(ideas), search ? 1 : 0, now).run();
  return json({ ideas, used_search: search, created_at: now });
};
