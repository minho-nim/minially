import { json, type HubContext } from '../../../../../shared/server/d1';
import { ownDraft } from '../../../_draftContext';
import { listVersions } from '../../../_writing';

// GET /api/drafts/:id/versions → { versions: [{id, kind, title, body, created_at}] } (최근 것부터 30개)
// 되돌리기는 화면이 그 판의 글을 본문에 넣고 평소처럼 저장한다(따로 쓰기 API 없음).
export const onRequestGet = async (ctx: HubContext) => {
  const own = await ownDraft(ctx);
  if (own instanceof Response) return own;
  return json({ versions: await listVersions(own.db, own.user, own.draft.id) });
};
