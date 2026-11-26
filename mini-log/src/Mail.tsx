import { useEffect, useState } from 'react';
import { api } from '../../shared/client/api';
import { Help } from './Help';
import { SafeMailHtml } from './MailHtml';
import { MailEditor } from './MailEditor';
import { docFromText, docToHtml, docToText, type MailDoc } from '../functions/_mailDoc';

// 메일: 네이버 메일에서 15분마다 받은 메일을 메일 앱처럼(왼쪽 목록·오른쪽 읽기) 보고, 서식 있는 답장·새 메일을 쓴다.
// AI가 협찬 관련을 골라 협찬·캘린더에 담고 답장 초안을 써 두지만, 보내기는 사람이 '보내기 → 보내기 확정'을 눌러야만 된다.
type Kind = 'offer' | 'notice' | 'pitch_reply' | 'other' | 'unknown' | 'outgoing';
export interface MailItem {
  id: string; from_name: string; from_addr: string; to_addr: string; subject: string; received_at: number; snippet: string;
  kind: Kind; brand: string; summary: string; deadline: string | null; needs_reply: number;
  reply_subject: string; reply_body: string; status: 'new' | 'drafted' | 'sent' | 'done'; campaign_id: string | null; sent_at: number | null;
}
type FullMail = MailItem & { body_html: string; reply_doc: MailDoc | null };
interface MailData { connected: boolean; address: string; mails: MailItem[]; synced_at: number | null; error: string; waiting: number }
type Folder = 'sponsor' | 'waiting' | 'sent' | 'all';

const KIND: Record<Kind, string> = { offer: '협찬 제안', notice: '진행 안내', pitch_reply: '내 제안에 온 답장', other: '기타', unknown: '분류 전', outgoing: '보낸 메일' };
const FOLDERS: [Folder, string][] = [['sponsor', '협찬 관련'], ['waiting', '답장 기다림'], ['sent', '보낸 메일'], ['all', '전체']];
const when = (ms: number) => new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const shortDay = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const isWaiting = (m: MailItem) => !!m.needs_reply && m.kind !== 'other' && (m.status === 'new' || m.status === 'drafted');
const inFolder = (m: MailItem, f: Folder) => (f === 'all' ? true : f === 'sent' ? m.status === 'sent' : f === 'waiting' ? isWaiting(m) : m.kind !== 'other' && m.kind !== 'outgoing');
const empty = (): MailDoc => [{ type: 'p', runs: [] }];

export function MailView({ onBack, onCampaigns, onWaiting }: { onBack: () => void; onCampaigns: () => void; onWaiting: (n: number) => void }) {
  const [data, setData] = useState<MailData | null>(null);
  const [folder, setFolder] = useState<Folder>('sponsor');
  const [open, setOpen] = useState<FullMail | null>(null);
  const [compose, setCompose] = useState<{ to: string; subject: string; doc: MailDoc } | null>(null);
  const [reply, setReply] = useState<{ subject: string; doc: MailDoc; dirty: boolean } | null>(null);
  const [plain, setPlain] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const fail = (e: unknown, text: string) => setMessage({ kind: 'error', text: e instanceof Error ? e.message : text });
  const apply = (d: MailData) => { setData(d); onWaiting(d.waiting); };

  useEffect(() => { api<MailData>('/api/mail').then(apply).catch(e => fail(e, '메일을 불러오지 못했어요.')); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const upsert = (mail: MailItem) => setData(d => {
    if (!d) return d;
    const mails = d.mails.some(m => m.id === mail.id) ? d.mails.map(m => (m.id === mail.id ? { ...m, ...mail } : m)) : [mail, ...d.mails];
    const waiting = mails.filter(isWaiting).length;
    onWaiting(waiting);
    return { ...d, mails, waiting };
  });
  const show = (mail: FullMail) => {
    setOpen(mail); setCompose(null); setConfirm(false); setPlain(false);
    setReply({ subject: mail.reply_subject || `Re: ${mail.subject}`, doc: mail.reply_doc ?? (mail.reply_body ? docFromText(mail.reply_body) : empty()), dirty: false });
  };

  async function select(id: string) {
    setBusy(`open:${id}`); setMessage(null);
    try { show((await api<{ mail: FullMail }>(`/api/mail/${id}`)).mail); } catch (e) { fail(e, '메일을 열지 못했어요.'); }
    finally { setBusy(null); }
  }

  async function sync() {
    setBusy('sync'); setMessage(null);
    try {
      const r = await api<MailData & { added: number }>('/api/mail/sync', { body: {} });
      apply(r);
      setMessage(r.error ? { kind: 'error', text: r.error } : { kind: 'info', text: r.added ? `새 메일 ${r.added}통을 받았어요.` : '새 메일이 없어요.' });
    } catch (e) { fail(e, '메일을 받지 못했어요.'); }
    finally { setBusy(null); }
  }

  async function act(kind: 'save' | 'done' | 'draft' | 'send') {
    if (!open || !reply) return;
    setBusy(kind); setMessage(null);
    try {
      let mail = open;
      if (kind !== 'draft' && (reply.dirty || kind === 'save' || kind === 'done'))
        mail = (await api<{ mail: FullMail }>(`/api/mail/${open.id}`, { method: 'PUT', body: { reply_subject: reply.subject, reply_doc: reply.doc, ...(kind === 'done' ? { status: 'done' } : {}) } })).mail;
      if (kind === 'draft') mail = (await api<{ mail: FullMail }>(`/api/mail/${open.id}/draft`, { body: {} })).mail;
      if (kind === 'send') mail = (await api<{ mail: FullMail }>(`/api/mail/${open.id}/send`, { body: {} })).mail;
      upsert(mail); show(mail);
      setMessage({ kind: 'info', text: kind === 'send' ? `${open.from_addr}에게 보냈어요.` : kind === 'done' ? '답장 안 함으로 표시했어요.' : kind === 'draft' ? 'AI가 초안을 다시 썼어요. 읽고 고쳐 주세요.' : '저장했어요.' });
    } catch (e) { fail(e, kind === 'send' ? '보내지 못했어요.' : '저장하지 못했어요.'); }
    finally { setBusy(null); setConfirm(false); }
  }

  async function sendNew() {
    if (!compose) return;
    setBusy('compose'); setMessage(null);
    try {
      const { mail } = await api<{ mail: FullMail }>('/api/mail/compose', { body: compose });
      upsert(mail); setCompose(null); show(mail); setFolder('sent');
      setMessage({ kind: 'info', text: `${mail.to_addr}에게 보냈어요.` });
    } catch (e) { fail(e, '보내지 못했어요.'); }
    finally { setBusy(null); setConfirm(false); }
  }

  const list = (data?.mails ?? []).filter(m => inFolder(m, folder));
  const reading = !!open || !!compose;
  const canReply = open && open.kind !== 'outgoing' && open.kind !== 'other' && open.status !== 'sent';
  return (
    <article className="stack" aria-labelledby="mail-title">
      <div className="editor-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn ghost back" onClick={onBack}>← 목록</button>
          <h1 id="mail-title" style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>메일</h1>
        </div>
        {data?.connected && (
          <div className="publish-row" style={{ alignItems: 'center' }}>
            <button className="btn" onClick={() => { void sync(); }} disabled={busy !== null}>{busy === 'sync' ? '받는 중…' : '지금 받기'}</button>
            <button className="btn primary" onClick={() => { setOpen(null); setReply(null); setConfirm(false); setCompose({ to: '', subject: '', doc: empty() }); }} disabled={busy !== null}>새 메일</button>
          </div>
        )}
      </div>
      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}
      {data && !data.connected && (
        <section className="card step" aria-labelledby="mail-conn">
          <h2 id="mail-conn" className="step-title">네이버 메일 연결</h2>
          <p className="small" style={{ margin: 0 }}>연결하면 15분마다 새 메일을 받아 협찬 관련 메일을 고르고 답장 초안을 써 둬요.</p>
          <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
            <li>네이버 메일 → 환경설정 → POP3/IMAP 설정에서 IMAP 사용을 켜요.</li>
            <li>네이버 2단계 인증을 켜고 메일용 애플리케이션 비밀번호를 만들어요(진짜 비밀번호는 쓰지 않아요).</li>
            <li>관리자가 Cloudflare 비밀값에 넣어요. 채팅에는 붙여 넣지 마세요.</li>
          </ol>
        </section>
      )}
      {data?.error && <p className="error small" role="alert" style={{ margin: 0 }}>{data.error}</p>}

      <div className={`mail-app${reading ? ' is-reading' : ''}`}>
        <aside className="mail-side card" aria-label="메일 목록">
          <div className="mail-folders" role="tablist" aria-label="메일함">
            {FOLDERS.map(([key, label]) => {
              const n = key === 'waiting' ? (data?.waiting ?? 0) : 0;
              return <button key={key} role="tab" aria-selected={folder === key} className={folder === key ? 'on' : ''} onClick={() => setFolder(key)}>{label}{n > 0 && <span className="count">{n}</span>}</button>;
            })}
          </div>
          {data?.connected && <p className="muted small" style={{ margin: '0 4px' }}>{data.address} · {data.synced_at ? `${when(data.synced_at)}에 받음` : '아직 받지 않음'} · 15분마다 자동</p>}
          <ul className="mail-rows">
            {list.map(m => (
              <li key={m.id}>
                <button type="button" className={`mail-row${open?.id === m.id ? ' on' : ''}${m.status === 'new' ? ' unread' : ''}`} onClick={() => { void select(m.id); }} disabled={busy !== null}>
                  <span className="mail-row-top"><b>{m.kind === 'outgoing' ? `받는 사람: ${m.to_addr}` : (m.from_name || m.from_addr)}</b><span className="muted small">{when(m.sent_at ?? m.received_at)}</span></span>
                  <span className="mail-row-subject">{m.subject || '(제목 없음)'}</span>
                  <span className="mail-row-meta">
                    <span className={`src${m.kind === 'offer' || m.kind === 'pitch_reply' ? ' s-season' : ''}`}>{KIND[m.kind]}</span>
                    {isWaiting(m) && <span className="small mail-flag">답장 필요</span>}
                    {m.status === 'sent' && m.kind !== 'outgoing' && <span className="small muted">답장함</span>}
                    <span className="muted small mail-row-summary">{m.summary || m.snippet.slice(0, 60)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {data && list.length === 0 && <p className="muted small" style={{ margin: 4 }}>{data.connected ? '이 메일함은 비어 있어요.' : '메일을 연결하면 여기에 모여요.'}</p>}
        </aside>

        <section className="mail-read card" aria-label={compose ? '새 메일 쓰기' : '메일 읽기'}>
          {reading && <button className="btn ghost back mail-back" onClick={() => { setOpen(null); setCompose(null); setReply(null); }}>← 메일 목록</button>}
          {!reading && <p className="muted small" style={{ margin: 0 }}>왼쪽에서 메일을 고르거나 '새 메일'을 눌러 주세요.</p>}

          {compose && (
            <div className="stack">
              <h2 className="step-title" style={{ margin: 0 }}>새 메일</h2>
              <label className="small" htmlFor="compose-to">받는 사람</label>
              <input id="compose-to" className="input" type="email" value={compose.to} placeholder="brand@example.com" onChange={e => setCompose(c => c && { ...c, to: e.target.value })} />
              <label className="small" htmlFor="compose-subject">제목</label>
              <input id="compose-subject" className="input" maxLength={200} value={compose.subject} onChange={e => setCompose(c => c && { ...c, subject: e.target.value })} />
              <MailEditor label="메일 내용" doc={compose.doc} onChange={doc => setCompose(c => c && { ...c, doc })} disabled={busy !== null} />
              {confirm ? (
                <div className="publish-row" role="group" aria-label="보내기 확인">
                  <span className="small" style={{ flex: '1 1 200px' }}><b>{compose.to}</b>에게 이 메일을 보낼까요?</span>
                  <button className="btn primary" onClick={() => { void sendNew(); }} disabled={busy !== null}>{busy === 'compose' ? '보내는 중…' : '보내기 확정'}</button>
                  <button className="btn ghost" onClick={() => setConfirm(false)} disabled={busy !== null}>취소</button>
                </div>
              ) : (
                <div className="idea-actions">
                  <button className="btn primary" onClick={() => setConfirm(true)} disabled={busy !== null || !compose.to.includes('@') || !compose.subject.trim() || !docToText(compose.doc).trim()}>보내기</button>
                  <button className="btn ghost" onClick={() => setCompose(null)} disabled={busy !== null}>쓰기 취소</button>
                </div>
              )}
            </div>
          )}

          {open && (
            <div className="stack">
              <div className="mail-read-head">
                <h2 className="mail-read-subject">{open.subject || '(제목 없음)'}</h2>
                <span className="small">{open.kind === 'outgoing' ? <>받는 사람 <b>{open.to_addr}</b></> : <><b>{open.from_name || open.from_addr}</b>{open.from_name && <span className="muted"> &lt;{open.from_addr}&gt;</span>}</>}<span className="muted"> · {when(open.sent_at ?? open.received_at)}</span></span>
                <span className="mail-row-meta">
                  <span className={`src${open.kind === 'offer' || open.kind === 'pitch_reply' ? ' s-season' : ''}`}>{KIND[open.kind]}</span>
                  {open.campaign_id && <button type="button" className="link-btn small" onClick={onCampaigns}>협찬에 담음{open.brand ? `: ${open.brand}` : ''}</button>}
                  {open.deadline && <span className="muted small">날짜 {shortDay(open.deadline)}(캘린더에 표시)</span>}
                </span>
                {open.summary && <p className="small mail-summary">AI 요약 · {open.summary}</p>}
              </div>
              <div className="mail-body-box">
                {open.kind === 'outgoing' ? <SafeMailHtml html={docToHtml(open.reply_doc ?? docFromText(open.reply_body))} />
                  : open.body_html && !plain ? <SafeMailHtml html={open.body_html} /> : <p className="mail-body">{open.snippet}</p>}
              </div>
              {open.body_html && open.kind !== 'outgoing' && <button type="button" className="link-btn small" style={{ justifySelf: 'start' }} onClick={() => setPlain(p => !p)}>{plain ? '원래 모양으로 보기' : '글만 보기'}</button>}

              {canReply && reply && open.status !== 'done' && (
                <div className="mail-reply">
                  <div className="row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 className="step-title" style={{ margin: 0, fontSize: '1rem' }}>답장</h3>
                    <Help short={'AI 초안은 그대로 보내지 말고 읽고 고친 뒤 보내 주세요.'}>[확인 필요]로 남긴 곳은 사실을 확인해 고쳐 주세요. 보내기는 '보내기 → 보내기 확정'을 눌러야만 되고, 내 네이버 메일로 발송돼요.</Help>
                  </div>
                  <label className="small" htmlFor="reply-subject">답장 제목</label>
                  <input id="reply-subject" className="input" maxLength={200} value={reply.subject} onChange={e => setReply(r => r && { ...r, subject: e.target.value, dirty: true })} />
                  <MailEditor label="답장 내용" doc={reply.doc} onChange={doc => setReply(r => r && { ...r, doc, dirty: true })} disabled={busy !== null} />
                  {confirm ? (
                    <div className="publish-row" role="group" aria-label="보내기 확인">
                      <span className="small" style={{ flex: '1 1 200px' }}><b>{open.from_addr}</b>에게 이 답장을 보낼까요?</span>
                      <button className="btn primary" onClick={() => { void act('send'); }} disabled={busy !== null}>{busy === 'send' ? '보내는 중…' : '보내기 확정'}</button>
                      <button className="btn ghost" onClick={() => setConfirm(false)} disabled={busy !== null}>취소</button>
                    </div>
                  ) : (
                    <div className="idea-actions">
                      <button className="btn primary" onClick={() => setConfirm(true)} disabled={busy !== null || !docToText(reply.doc).trim() || !data?.connected}>보내기</button>
                      <button className="btn" onClick={() => { void act('save'); }} disabled={busy !== null || !reply.dirty}>저장</button>
                      <button className="btn" onClick={() => { void act('draft'); }} disabled={busy !== null}>{busy === 'draft' ? '쓰는 중…' : open.reply_body ? 'AI 초안 다시 쓰기' : 'AI 초안 쓰기'}</button>
                      <button className="btn ghost" onClick={() => { void act('done'); }} disabled={busy !== null}>답장 안 함</button>
                    </div>
                  )}
                </div>
              )}
              {open.status === 'sent' && open.kind !== 'outgoing' && <p className="small badge-ok" style={{ justifySelf: 'start' }}>답장을 보냈어요 · {open.sent_at ? when(open.sent_at) : ''}</p>}
              {open.status === 'done' && <p className="muted small" style={{ margin: 0 }}>답장 안 함으로 표시한 메일이에요.</p>}
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
