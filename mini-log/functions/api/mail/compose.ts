import { json, readJson, type HubContext } from '../../../../shared/server/d1';
import { requireSession } from '../../../../shared/server/auth';
import { sendNew } from '../../_mail';
import { readMailDoc } from '../../_mailDoc';

// POST { to, subject, doc }: 새 메일 보내기(협찬 제안 등). 사람이 '보내기 확정'을 눌렀을 때만 화면이 부른다
export const onRequestPost = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const body = (await readJson(ctx.request)) ?? {};
  const to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : '';
  if (!/^[^\s@<>,;"]{1,64}@[^\s@<>,;"]{1,190}\.[a-z]{2,}$/i.test(to)) return json({ error: '받는 사람 메일 주소를 확인해 주세요(한 명만).' }, 400);
  const subject = typeof body.subject === 'string' ? body.subject.replace(/[\r\n]/g, ' ').trim() : '';
  if (!subject || subject.length > 200) return json({ error: '제목을 200자 안으로 적어 주세요.' }, 400);
  const doc = readMailDoc(body.doc);
  if (!doc) return json({ error: '내용이 너무 길거나 형식이 올바르지 않아요.' }, 400);
  const sent = await sendNew(auth.db, ctx.env, auth.session.user, to, subject, doc);
  if (typeof sent === 'string') return json({ error: sent }, 409);
  return json({ mail: sent }, 201);
};
