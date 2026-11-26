import { json, readJson, type HubContext } from '../../../../../shared/server/d1';
import { requireSession } from '../../../../../shared/server/auth';
import { getMail } from '../../../_mail';

// PUT { reply_subject?, reply_body?, status?: 'done' | 'drafted' }: 답장 고치기·처리 완료(보낸 메일은 못 고침)
export const onRequestPut = async (ctx: HubContext) => {
  const auth = await requireSession(ctx, 'minilog');
  if (auth instanceof Response) return auth;
  const { db, session: { user } } = auth;
  const id = String(ctx.params?.id ?? "");
  const mail = await getMail(db, user, id);
  if (!mail) return json({ error: '메일을 찾지 못했어요.' }, 404);
  if (mail.status === 'sent') return json({ error: '이미 보낸 답장은 고칠 수 없어요.' }, 409);
  const body = (await readJson(ctx.request)) ?? {};
  const subject = body.reply_subject === undefined ? mail.reply_subject : body.reply_subject;
  const text = body.reply_body === undefined ? mail.reply_body : body.reply_body;
  if (typeof subject !== 'string' || subject.length > 200 || typeof text !== 'string' || text.length > 6000) return json({ error: '답장이 너무 길거나 형식이 올바르지 않아요.' }, 400);
  if (body.status !== undefined && body.status !== 'done' && body.status !== 'drafted') return json({ error: '상태가 올바르지 않아요.' }, 400);
  const status = (body.status as string | undefined) ?? (text.trim() ? 'drafted' : mail.status);
  await db.prepare('UPDATE minilog_mails SET reply_subject = ?, reply_body = ?, status = ? WHERE user = ? AND id = ?').bind(subject, text, status, user, id).run();
  return json({ mail: await getMail(db, user, id) });
};
