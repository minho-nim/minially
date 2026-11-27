// 메일 자동 처리: 네이버·Gmail에서 새 메일을 받아(IMAP) 한 메일함에 모으고, AI가 협찬 제안·체험단 안내·내 제안에 온 답장으로 나누고,
// 협찬(→ 캘린더·휴대폰 달력)에 담고, 답장이 필요한 메일엔 초안을 써 둔다. 보내기는 사람이 누를 때만(SMTP).
import type { D1Database, HubEnv } from '../../shared/server/d1';
import type { UserName } from '../../shared/server/auth';
import { AiError, LIGHT_MODEL, callGemini } from '../../shared/server/ai';
import { createCampaign, listCampaigns, updateCampaign } from './_campaigns';
import { COLUMNS, KEEP_DAYS, LOCK_MS, classifyPrompt, readJudgements, readReplies, replyPrompt, sameBrand, str, type Judgement, type Mail, type MailKind } from './_mailRules';
export type { Mail } from './_mailRules';
import { buildMail, parseMail } from './_mime';
import { docFromText, docToHtml, docToText, readMailDoc, type MailDoc } from './_mailDoc';
import { MailError, PROVIDER_LABEL, fetchNew, mailAccountOf, mailAccounts, sendMail, type MailAccount, type Provider } from './_mailbox';

async function linkCampaign(db: D1Database, user: UserName, j: Judgement, subject: string): Promise<string | null> {
  if (!['offer', 'notice', 'pitch_reply'].includes(j.kind) || !j.brand) return null;
  const open = (await listCampaigns(db, user)).campaigns.filter(c => c.status !== 'cancelled' && c.status !== 'paid' && sameBrand(c.brand, j.brand));
  if (j.kind === 'pitch_reply') {
    const c = open.find(x => x.pitch) ?? open[0];
    if (!c) return null;
    if (c.pitch && j.answer !== 'unknown') await updateCampaign(db, user, c.id, { pitch: { ...c.pitch, reply: j.answer } });
    return c.id;
  }
  const existing = open[0];
  if (existing) {
    const patch: Parameters<typeof updateCampaign>[3] = {};
    if (!existing.deadline && j.deadline) patch.deadline = j.deadline;
    if (j.kind === 'notice' && ['interested', 'applied', 'proposed'].includes(existing.status)) patch.status = 'in_progress';
    if (Object.keys(patch).length) await updateCampaign(db, user, existing.id, patch);
    return existing.id;
  }
  const made = await createCampaign(db, user, {
    kind: 'sponsor', brand: j.brand, title: j.title, amount: j.amount, deadline: j.deadline, status: j.kind === 'notice' ? 'in_progress' : 'proposed',
    memo: `메일에서 담음: ${subject}`.slice(0, 1000),
    guide: j.visit_on ? { keywords: [], hashtags: [], min_photos: null, min_chars: null, links: [], visit_on: j.visit_on, notes: '' } : null,
  });
  return typeof made === 'string' ? null : made.id;
}

async function signatureOf(db: D1Database, user: UserName) {
  const form = await db.prepare('SELECT form FROM minilog_proposals WHERE user = ?').bind(user).first<{ form: string }>();
  try { const f = form ? JSON.parse(form.form) : {}; return str(f.blog_name, 60) || '블로거 드림'; } catch { return '블로거 드림'; }
}

/** 답장 초안 쓰기(답장이 필요한 메일만). 실패하면 초안 없이 둔다 */
export async function draftReplies(db: D1Database, env: HubEnv, user: UserName, mails: Mail[]) {
  if (!mails.length) return 0;
  const { text } = await callGemini({ env, db, user, app: 'minilog', task: 'mail_reply', json: true,
    prompt: replyPrompt(await signatureOf(db, user), mails.map(m => ({ id: m.id, from: `${m.from_name} <${m.from_addr}>`, subject: m.subject, text: m.snippet, kind: m.kind }))) });
  const replies = readReplies(text, mails.map(m => m.id));
  for (const r of replies) {
    const subject = r.subject || `Re: ${mails.find(m => m.id === r.id)?.subject ?? ''}`;
    await db.prepare("UPDATE minilog_mails SET reply_subject = ?, reply_body = ?, reply_doc = ?, status = CASE WHEN status = 'new' THEN 'drafted' ELSE status END WHERE user = ? AND id = ? AND status != 'sent'").bind(subject, r.body, JSON.stringify(docFromText(r.body)), user, r.id).run();
  }
  return replies.length;
}

const kstDate = (ms: number) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);

/**
 * 메일 번호(UID)는 계정마다 따로 세서 겹칠 수 있다. 기존 고유 색인(user, uid)을 지우지 않고 Gmail 번호는 2^32를 더해 둔다.
 * shortcut: 계정이 셋 이상이 되면 (user, account, uid) 색인으로 옮긴다(옛 색인 삭제는 소유자 승인 뒤)
 */
const UID_OFFSET: Record<Provider, number> = { naver: 0, gmail: 2 ** 32 };

/** 계정 하나에서 새 메일 받기. 네이버는 처음이면 예전 받은 위치(minilog_mail_state)를 이어받는다 */
async function fetchAccount(db: D1Database, env: HubEnv, user: UserName, account: MailAccount, now: number, fresh: (Mail & { bulk: boolean })[]) {
  let cursor = await db.prepare('SELECT uid_validity, last_uid FROM minilog_mail_cursor WHERE user = ? AND account = ?').bind(user, account.provider).first<{ uid_validity: number; last_uid: number }>();
  if (!cursor && account.provider === 'naver') cursor = await db.prepare('SELECT uid_validity, last_uid FROM minilog_mail_state WHERE user = ?').bind(user).first<{ uid_validity: number; last_uid: number }>();
  let last = cursor?.last_uid ?? 0;
  const got = await fetchNew(env, account, last);
  if (cursor?.uid_validity && got.uidValidity && cursor.uid_validity !== got.uidValidity) last = 0; // 메일함이 바뀌면 처음부터
  let added = 0;
  for (const m of got.mails) {
    const p = parseMail(m.raw);
    const id = crypto.randomUUID();
    const res = await db.prepare('INSERT OR IGNORE INTO minilog_mails (id, user, uid, message_id, refs, from_name, from_addr, subject, received_at, snippet, kind, body_html, account, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, user, m.uid + UID_OFFSET[account.provider], p.messageId, p.references, p.from.name.slice(0, 100), p.from.address.slice(0, 200), p.subject, p.date ?? now, p.text.slice(0, 4000), p.bulk ? 'other' : 'unknown', p.html, account.provider, now).run() as { meta?: { changes?: number } };
    last = Math.max(last, m.uid);
    if (res?.meta?.changes) {
      added++;
      fresh.push({ id, from_name: p.from.name, from_addr: p.from.address, subject: p.subject, received_at: p.date ?? now, snippet: p.text.slice(0, 4000), kind: p.bulk ? 'other' : 'unknown', brand: '', summary: '', deadline: null, needs_reply: 0, reply_subject: '', reply_body: '', status: 'new', campaign_id: null, sent_at: null, to_addr: '', account: account.provider, bulk: p.bulk });
    }
  }
  await db.prepare('INSERT INTO minilog_mail_cursor (user, account, uid_validity, last_uid) VALUES (?, ?, ?, ?) ON CONFLICT(user, account) DO UPDATE SET uid_validity = excluded.uid_validity, last_uid = excluded.last_uid')
    .bind(user, account.provider, got.uidValidity, last).run();
  return added;
}

/** 새 메일 받기(연결된 계정 모두) → 분류 → 협찬 담기 → 답장 초안. 같은 사람 것이 동시에 두 번 돌지 않게 잠근다 */
export async function syncMail(db: D1Database, env: HubEnv, user: UserName): Promise<{ added: number; skipped?: 'no_account' | 'busy'; error?: string }> {
  const accounts = mailAccounts(env, user);
  if (!accounts.length) return { added: 0, skipped: 'no_account' };
  const now = Date.now();
  await db.prepare('INSERT OR IGNORE INTO minilog_mail_state (user) VALUES (?)').bind(user).run();
  const lock = await db.prepare('UPDATE minilog_mail_state SET lock_until = ? WHERE user = ? AND lock_until < ?').bind(now + LOCK_MS, user, now).run() as { meta?: { changes?: number } };
  if (lock?.meta?.changes === 0) return { added: 0, skipped: 'busy' };
  const errors: string[] = [];
  let added = 0;
  try {
    const fresh: (Mail & { bulk: boolean })[] = [];
    // 한 계정이 실패해도 다른 계정은 받는다(오류는 계정 이름을 붙여 남김)
    for (const account of accounts) {
      try { added += await fetchAccount(db, env, user, account, now, fresh); }
      catch (e) { if (!(e instanceof MailError)) throw e; errors.push(accounts.length > 1 ? `${PROVIDER_LABEL[account.provider]}: ${e.message}` : e.message); }
    }
    const judge = fresh.filter(m => !m.bulk);
    if (judge.length) {
      try {
        const { text } = await callGemini({ env, db, user, app: 'minilog', task: 'mail_classify', json: true, model: LIGHT_MODEL,
          prompt: classifyPrompt(kstDate(now), judge.map(m => ({ id: m.id, from: `${m.from_name} <${m.from_addr}>`, subject: m.subject, date: kstDate(m.received_at), text: m.snippet }))) });
        const toDraft: Mail[] = [];
        for (const j of readJudgements(text, judge.map(m => m.id))) {
          const mail = judge.find(m => m.id === j.id)!;
          const campaign = await linkCampaign(db, user, j, mail.subject);
          await db.prepare('UPDATE minilog_mails SET kind = ?, brand = ?, summary = ?, deadline = ?, needs_reply = ?, campaign_id = ? WHERE user = ? AND id = ?')
            .bind(j.kind, j.brand, j.summary, j.deadline ?? j.visit_on, j.needs_reply ? 1 : 0, campaign, user, j.id).run();
          if (j.needs_reply && j.kind !== 'other') toDraft.push({ ...mail, kind: j.kind });
        }
        await draftReplies(db, env, user, toDraft);
      } catch (e) {
        if (!(e instanceof AiError)) throw e;
        errors.push(`메일은 받았지만 AI가 분류하지 못했어요: ${e.message}`);
      }
    }
    await db.prepare('DELETE FROM minilog_mails WHERE user = ? AND received_at < ?').bind(user, now - KEEP_DAYS * 86400000).run();
  } finally {
    await db.prepare('UPDATE minilog_mail_state SET synced_at = ?, error = ?, lock_until = 0 WHERE user = ?').bind(Date.now(), errors.join(' / ').slice(0, 500), user).run();
  }
  return { added, ...(errors.length ? { error: errors.join(' / ') } : {}) };
}

export async function listMails(db: D1Database, user: UserName) {
  const mails = (await db.prepare(`SELECT ${COLUMNS} FROM minilog_mails WHERE user = ? ORDER BY received_at DESC LIMIT 100`).bind(user).all<Mail>()).results;
  const state = await db.prepare('SELECT synced_at, error FROM minilog_mail_state WHERE user = ?').bind(user).first<{ synced_at: number | null; error: string }>();
  return { mails, synced_at: state?.synced_at ?? null, error: state?.error ?? '', waiting: mails.filter(m => m.needs_reply && m.kind !== 'other' && (m.status === 'new' || m.status === 'drafted')).length };
}

export type FullMail = Mail & { message_id: string; refs: string; body_html: string; reply_doc: MailDoc | null };
/** 메일 한 통(받은 HTML 원문·서식 답장 포함) */
export async function getMail(db: D1Database, user: UserName, id: string): Promise<FullMail | null> {
  const row = await db.prepare(`SELECT ${COLUMNS}, message_id, refs, COALESCE(body_html, '') AS body_html, COALESCE(reply_doc, '') AS reply_doc FROM minilog_mails WHERE user = ? AND id = ?`).bind(user, id)
    .first<Mail & { message_id: string; refs: string; body_html: string; reply_doc: string }>();
  if (!row) return null;
  let doc: MailDoc | null = null;
  try { doc = row.reply_doc ? readMailDoc(JSON.parse(row.reply_doc)) : null; } catch { doc = null; }
  return { ...row, reply_doc: doc };
}

/** 서식 답장 저장: 문서를 검사하고 글만 버전도 함께 둔다 */
export async function saveReply(db: D1Database, user: UserName, id: string, subject: string, doc: MailDoc, status: 'drafted' | 'done') {
  await db.prepare('UPDATE minilog_mails SET reply_subject = ?, reply_body = ?, reply_doc = ?, status = ? WHERE user = ? AND id = ?').bind(subject, docToText(doc), JSON.stringify(doc), status, user, id).run();
}

/** 사람이 '보내기'를 눌렀을 때: 저장된 답장을 내 계정으로 보낸다 */
export async function sendReply(db: D1Database, env: HubEnv, user: UserName, id: string): Promise<true | string> {
  const mail = await getMail(db, user, id);
  if (!mail) return '메일을 찾지 못했어요.';
  // 답장은 그 메일을 받은 계정으로 보낸다
  const provider: Provider = mail.account === 'gmail' ? 'gmail' : 'naver';
  const account = mailAccountOf(env, user, provider);
  if (!account) return `${PROVIDER_LABEL[provider]} 메일이 연결되지 않았어요.`;
  if (mail.status === 'sent') return '이미 보낸 답장이에요.';
  if (!mail.reply_body.trim() || !mail.from_addr) return '보낼 답장 내용이 없어요.';
  const raw = buildMail({ from: account.address, to: mail.from_addr, subject: mail.reply_subject || `Re: ${mail.subject}`, body: mail.reply_doc ? docToText(mail.reply_doc) : mail.reply_body, html: mail.reply_doc ? docToHtml(mail.reply_doc) : undefined,
    inReplyTo: mail.message_id || undefined, references: mail.refs || undefined, id: `<${crypto.randomUUID()}@minilog>` });
  try { await sendMail(env, account, mail.from_addr, raw); } catch (e) { if (e instanceof MailError) return e.message; throw e; }
  await db.prepare("UPDATE minilog_mails SET status = 'sent', sent_at = ? WHERE user = ? AND id = ?").bind(Date.now(), user, id).run();
  return true;
}

/** 새 메일 보내기(협찬 제안 등): 사람이 '보내기 확정'을 눌렀을 때만. 보낸 메일은 '보낸 메일'에 남긴다 */
export async function sendNew(db: D1Database, env: HubEnv, user: UserName, to: string, subject: string, doc: MailDoc, from?: Provider): Promise<FullMail | string> {
  const account = from ? mailAccountOf(env, user, from) : mailAccounts(env, user)[0] ?? null;
  if (!account) return from ? `${PROVIDER_LABEL[from]} 메일이 연결되지 않았어요.` : '메일이 아직 연결되지 않았어요.';
  const text = docToText(doc);
  if (!text.trim()) return '보낼 내용이 없어요.';
  const raw = buildMail({ from: account.address, to, subject, body: text, html: docToHtml(doc), id: `<${crypto.randomUUID()}@minilog>` });
  try { await sendMail(env, account, to, raw); } catch (e) { if (e instanceof MailError) return e.message; throw e; }
  const id = crypto.randomUUID(), now = Date.now();
  // 내가 쓴 메일은 IMAP 번호가 없어 음수 번호로 둔다(받은 메일과 겹치지 않음)
  await db.prepare("INSERT INTO minilog_mails (id, user, uid, from_addr, to_addr, subject, received_at, snippet, kind, reply_subject, reply_body, reply_doc, status, sent_at, account, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'outgoing', ?, ?, ?, 'sent', ?, ?, ?)")
    .bind(id, user, -now - Math.floor(Math.random() * 1000), account.address, to, subject, now, text.slice(0, 4000), subject, text, JSON.stringify(doc), now, account.provider, now).run();
  return (await getMail(db, user, id))!;
}
