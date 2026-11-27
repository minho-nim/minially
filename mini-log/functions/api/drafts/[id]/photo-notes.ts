import { json, type HubContext } from '../../../../../shared/server/d1';
import { callGemini, LIGHT_MODEL } from '../../../../../shared/server/ai';
import { aiFail, draftContext, ownDraft } from '../../../_draftContext';
import { photoNotePrompt, parseJson, readPhotoNotes } from '../../../_writing';

// POST /api/drafts/:id/photo-notes → { notes: [{photo_id, note}] }
// 메모가 빈 사진(앞 8장 중)에 "무엇이 찍혔는지" 한 줄 후보를 준다. 저장하지 않는다: 사람이 확인한 것만 화면에서 메모로 저장한다.
export const onRequestPost = async (ctx: HubContext) => {
  const own = await ownDraft(ctx);
  if (own instanceof Response) return own;
  const c = await draftContext(ctx.env, own.db, own.user, own.draft);
  if (!c.images.length) return json({ error: c.photos.length ? '사진 파일을 읽지 못했어요. 잠시 뒤 다시 시도해 주세요.' : '먼저 사진을 올려 주세요.' }, 400);
  try {
    const { text } = await callGemini({ env: ctx.env, db: own.db, user: own.user, app: 'minilog', task: 'photo_notes', images: c.images, json: true, model: LIGHT_MODEL, prompt: photoNotePrompt(c.images.length, 1) });
    const notes = readPhotoNotes(parseJson(text), 1, c.images.length)
      .filter(n => !c.photos[n.photo - 1]?.note.trim()) // 이미 적은 메모는 건드리지 않는다
      .map(n => ({ photo_id: c.photos[n.photo - 1].id, note: n.note }));
    return json({ notes });
  } catch (error) { return aiFail(error); }
};
