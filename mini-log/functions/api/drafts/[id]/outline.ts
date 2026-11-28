import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { callGemini } from '../../../../../shared/server/ai';
import { LIMITS } from '../../../_drafts';
import { aiFail, draftContext, ownDraft } from '../../../_draftContext';
import { cleanOutline, outlinePrompt, parseJson } from '../../../_writing';
import { isPostType, isStructure, STRUCTURES } from '../../../_postTypes';
import { isCustomKey, typeGuide } from '../../../_typeSettings';

// POST /api/drafts/:id/outline { experience, post_type, structure } → { sections: [{heading, points, photos}] }
// 본문을 쓰기 전에 소제목·문단별 내용·사진 번호를 먼저 보여 준다. 사람이 고친 개요는 generate에 { outline }으로 넘긴다.
export const onRequestPost = async (ctx: HubContext) => {
  const own = await ownDraft(ctx);
  if (own instanceof Response) return own;
  const body = await readJson(ctx.request);
  const experience = typeof body?.experience === 'string' ? body.experience.trim() : own.draft.experience.trim();
  if (experience.length < 10) return json({ error: '실제 방문·사용 경험을 10자 이상 적어 주세요.' }, 400);
  if (experience.length > LIMITS.experience) return json({ error: '경험 글이 너무 길어요.' }, 400);
  const postType = isPostType(body?.post_type) || isCustomKey(body?.post_type) ? body.post_type : own.draft.post_type;
  const structure = isStructure(body?.structure) ? body.structure : 'basic';
  const typeText = await typeGuide(own.db, own.user, postType);
  const c = await draftContext(ctx.env, own.db, own.user, own.draft);
  try {
    const { text } = await callGemini({
      env: ctx.env, db: own.db, user: own.user, app: 'minilog', task: 'draft_outline', images: c.images, json: true,
      prompt: outlinePrompt({ experience, title: own.draft.title, photoCount: c.photos.length, notes: c.notes, style: c.style, guide: c.guide,
        typeGuide: typeText, structureGuide: STRUCTURES[structure].guide }),
    });
    const raw = parseJson(text) as { sections?: unknown } | null;
    const sections = cleanOutline(raw?.sections, c.photos.length);
    if (!sections) return json({ error: 'AI가 개요를 만들지 못했어요. 다시 시도해 주세요.', code: 'bad_response' }, 502);
    return json({ sections, photos: c.photos.length });
  } catch (error) { return aiFail(error); }
};
