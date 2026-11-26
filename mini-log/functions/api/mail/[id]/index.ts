import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { getMail, saveReply } from '../../../_mail';
import { docFromText, readMailDoc } from '../../../_mailDoc';

// GET: 메일 한 통(받은 HTML 원문·서식 답장) · PUT { reply_subject?, reply_doc? | reply_body?, status?: 'done' | 'drafted' }: 답장 저장·처리 완료(보낸 메일은 못 고침)
export const onRequestGet = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const mail = await getMail(auth.db, auth.session.user, String(ctx.params?.id ?? ''));
  return mail ? json({ mail }) : json({ error: '메일을 찾지 못했어요.' }, 404);
};

export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session: { user } } = auth;
  const id = String(ctx.params?.id ?? '');
  const mail = await getMail(db, user, id);
  if (!mail) return json({ error: '메일을 찾지 못했어요.' }, 404);
  if (mail.status === 'sent') return json({ error: '이미 보낸 답장은 고칠 수 없어요.' }, 409);
  const body = (await readJson(ctx.request)) ?? {};
  const subject = body.reply_subject === undefined ? mail.reply_subject : body.reply_subject;
  if (typeof subject !== 'string' || subject.length > 200) return json({ error: '답장 제목이 너무 길거나 형식이 올바르지 않아요.' }, 400);
  let doc = mail.reply_doc ?? docFromText(mail.reply_body);
  if (body.reply_doc !== undefined) {
    const read = readMailDoc(body.reply_doc);
    if (!read) return json({ error: '답장이 너무 길거나 형식이 올바르지 않아요.' }, 400);
    doc = read;
  } else if (body.reply_body !== undefined) {
    if (typeof body.reply_body !== 'string' || body.reply_body.length > 6000) return json({ error: '답장이 너무 길거나 형식이 올바르지 않아요.' }, 400);
    doc = docFromText(body.reply_body);
  }
  if (body.status !== undefined && body.status !== 'done' && body.status !== 'drafted') return json({ error: '상태가 올바르지 않아요.' }, 400);
  await saveReply(db, user, id, subject, doc, (body.status as 'done' | 'drafted' | undefined) ?? (mail.status === 'done' ? 'done' : 'drafted'));
  return json({ mail: await getMail(db, user, id) });
};
