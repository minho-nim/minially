import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { callGemini } from '../../../../../shared/server/ai';
import { aiFail, ownDraft } from '../../../_draftContext';
import { guideForDraft } from '../../../_campaigns';
import { parseJson, readTitles, titlesPrompt } from '../../../_writing';

// POST /api/drafts/:id/titles { body?, title? } → { titles: [{title, reason, checks}], top: [{title, views}] }
// 제목 후보 3개(이유 + 규칙 점검: 길이·핵심어 위치·과장)와, 비교용 내 인기 글 제목(조회수 높은 순 3개).
export const onRequestPost = async (ctx: HubContext) => {
  const own = await ownDraft(ctx);
  if (own instanceof Response) return own;
  const input = await readJson(ctx.request);
  const body = (typeof input?.body === 'string' ? input.body : own.draft.body).trim();
  const title = typeof input?.title === 'string' ? input.title.slice(0, 200) : own.draft.title;
  if (body.length < 50) return json({ error: '본문이 50자 이상 있어야 제목을 추천할 수 있어요.' }, 400);
  const guide = await guideForDraft(own.db, own.user, own.draft.id);
  const keyword = guide?.guide.keywords[0] ?? own.draft.hashtags[0] ?? '';
  const top = (await own.db.prepare('SELECT title, views FROM minilog_posts WHERE user = ? AND views IS NOT NULL AND title != \'\' ORDER BY views DESC LIMIT 3').bind(own.user).all<{ title: string; views: number }>()).results;
  try {
    const { text } = await callGemini({ env: ctx.env, db: own.db, user: own.user, app: 'minilog', task: 'title_ideas', json: true, prompt: titlesPrompt(body, title, keyword, top.map(t => t.title)) });
    const titles = readTitles(parseJson(text), keyword);
    if (!titles.length) return json({ error: 'AI가 제목 후보를 만들지 못했어요. 다시 시도해 주세요.', code: 'bad_response' }, 502);
    return json({ titles, top, keyword });
  } catch (error) { return aiFail(error); }
};
