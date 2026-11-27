import { json, type HubContext, type HubEnv, type D1Database } from '../../shared/server/d1';
import { requireSession, type UserName } from '../../shared/server/auth';
import { AiError } from '../../shared/server/ai';
import { listPhotos, photoNotesBlock, PHOTO_LIMITS, toBase64, type Photo } from './_photos';
import { editedPairs, styleBlock, styleForDraft } from './_style';
import { guideForDraft } from './_campaigns';
import { editHabits, guideBlock, habitsBlock } from './_writing';
import { getDraft, type Draft } from './_drafts';

// AI 초안·개요가 같이 쓰는 재료: 사진(앞 8장 파일 + 전체 메모), 문체(+ 내가 고친 버릇), 연결된 협찬 가이드
export interface DraftContext { photos: Photo[]; images: { mimeType: string; data: string }[]; notes: string; style: string; guide: string; guideRaw: Awaited<ReturnType<typeof guideForDraft>> }

export async function draftContext(env: HubEnv, db: D1Database, user: UserName, draft: Draft, withImages = true): Promise<DraftContext> {
  const photos = await listPhotos(db, user, draft.id);
  const images: DraftContext['images'] = [];
  const bucket = env.MINILOG_PHOTOS;
  if (withImages && bucket) {
    for (const photo of photos.slice(0, PHOTO_LIMITS.forAi)) {
      const object = await bucket.get(`${user}/${draft.id}/${photo.id}`);
      if (object) images.push({ mimeType: photo.content_type, data: toBase64(new Uint8Array(await new Response(object.body).arrayBuffer())) });
    }
  }
  const style = await styleForDraft(db, user, draft.style_id);
  // 내 문체로 쓸 때만: 내가 AI 초안을 고친 버릇(규칙으로 뽑음, AI 호출 없음)을 문체 자료 뒤에 붙인다
  const habits = style?.kind === 'mine' ? habitsBlock(editHabits(await editedPairs(db, user))) : '';
  const guideRaw = await guideForDraft(db, user, draft.id);
  return {
    photos, images, notes: photoNotesBlock(photos.map(p => p.note)),
    style: [styleBlock(style), habits].filter(Boolean).join('\n'),
    guide: guideRaw ? guideBlock(guideRaw.brand, guideRaw.guide) : '', guideRaw,
  };
}

/** 원고 AI 도구 공통: 로그인·본인 원고 확인. 실패면 Response */
export async function ownDraft(ctx: HubContext): Promise<{ db: D1Database; user: UserName; draft: Draft } | Response> {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const id = typeof ctx.params?.id === 'string' ? ctx.params.id : '';
  const draft = /^[0-9a-f-]{36}$/.test(id) ? await getDraft(auth.db, auth.session.user, id) : null;
  if (!draft) return json({ error: '원고를 찾을 수 없어요.' }, 404);
  return { db: auth.db, user: auth.session.user, draft };
}

/** AI 오류는 쉬운 안내로, 그 밖의 것은 다시 던진다 */
export function aiFail(error: unknown): Response {
  if (error instanceof AiError) return json({ error: error.message, code: error.code }, error.status);
  throw error;
}
