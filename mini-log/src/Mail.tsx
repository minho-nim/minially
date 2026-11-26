import { useEffect, useState } from 'react';
import { api } from '../../shared/client/api';
import { Help } from './Help';

// 메일: 네이버 메일에서 자동으로 받은 메일 중 협찬 관련을 모아 보고, AI 답장 초안을 고쳐 '보내기'를 누를 때만 보낸다.
type Kind = 'offer' | 'notice' | 'pitch_reply' | 'other' | 'unknown';
export interface MailItem {
  id: string; from_name: string; from_addr: string; subject: string; received_at: number; snippet: string;
  kind: Kind; brand: string; summary: string; deadline: string | null; needs_reply: number;
  reply_subject: string; reply_body: string; status: 'new' | 'drafted' | 'sent' | 'done'; campaign_id: string | null; sent_at: number | null;
}
interface MailData { connected: boolean; address: string; mails: MailItem[]; synced_at: number | null; error: string; waiting: number }

const KIND: Record<Kind, string> = { offer: '협찬 제안', notice: '진행 안내', pitch_reply: '내 제안에 온 답장', other: '기타', unknown: '분류 전' };
const when = (ms: number) => new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const shortDay = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export function MailView({ onBack, onCampaigns, onWaiting }: { onBack: () => void; onCampaigns: () => void; onWaiting: (n: number) => void }) {
  const [data, setData] = useState<MailData | null>(null);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({});
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const fail = (e: unknown, text: string) => setMessage({ kind: 'error', text: e instanceof Error ? e.message : text });
  const apply = (d: MailData) => { setData(d); onWaiting(d.waiting); };

  useEffect(() => { api<MailData>('/api/mail').then(apply).catch(e => fail(e, '메일을 불러오지 못했어요.')); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const replace = (mail: MailItem) => setData(d => {
    if (!d) return d;
    const mails = d.mails.map(m => (m.id === mail.id ? mail : m));
    const waiting = mails.filter(m => m.needs_reply && m.kind !== 'other' && (m.status === 'new' || m.status === 'drafted')).length;
    onWaiting(waiting);
    return { ...d, mails, waiting };
  });

  async function sync() {
    setBusy('sync'); setMessage(null);
    try {
      const r = await api<MailData & { added: number }>('/api/mail/sync', { body: {} });
      apply(r);
      setMessage(r.error ? { kind: 'error', text: r.error } : { kind: 'info', text: r.added ? `새 메일 ${r.added}통을 받았어요.` : '새 메일이 없어요.' });
    } catch (e) { fail(e, '메일을 받지 못했어요.'); }
    finally { setBusy(null); }
  }

  async function act(mail: MailItem, kind: 'save' | 'done' | 'draft' | 'send') {
    setBusy(`${kind}:${mail.id}`); setMessage(null);
    const edit = edits[mail.id];
    try {
      if (edit && kind !== 'draft') await api(`/api/mail/${mail.id}`, { method: 'PUT', body: { reply_subject: edit.subject, reply_body: edit.body } });
      const path = kind === 'draft' ? `/api/mail/${mail.id}/draft` : kind === 'send' ? `/api/mail/${mail.id}/send` : `/api/mail/${mail.id}`;
      const r = await api<{ mail: MailItem }>(path, kind === 'done' ? { method: 'PUT', body: { status: 'done' } } : kind === 'save' ? { method: 'PUT', body: {} } : { body: {} });
      replace(r.mail);
      setEdits(e => { const c = { ...e }; delete c[mail.id]; return c; });
      setConfirm(null);
      setMessage({ kind: 'info', text: kind === 'send' ? `${mail.from_addr}에게 보냈어요.` : kind === 'done' ? '처리 완료로 표시했어요.' : kind === 'draft' ? 'AI가 초안을 다시 썼어요. 읽고 고쳐 주세요.' : '저장했어요.' });
    } catch (e) { fail(e, kind === 'send' ? '보내지 못했어요.' : '저장하지 못했어요.'); }
    finally { setBusy(null); }
  }

  const shown = (data?.mails ?? []).filter(m => all || m.kind !== 'other');
  return (
    <article className="stack" aria-labelledby="mail-title">
      <div className="editor-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn ghost back" onClick={onBack}>← 목록</button>
          <h1 id="mail-title" style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>메일</h1>
        </div>
      </div>
      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}

      <section className="card step" aria-labelledby="mail-conn">
        <h2 id="mail-conn" className="step-title">네이버 메일{data?.connected && <span className="step-sub">{data.address}</span>}</h2>
        {data && !data.connected && (
          <div className="small" style={{ display: 'grid', gap: 4 }}>
            <p style={{ margin: 0 }}>아직 연결되지 않았어요. 연결하면 15분마다 새 메일을 받아 협찬 관련 메일을 고르고 답장 초안을 써 둬요.</p>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li>네이버 메일 → 환경설정 → POP3/IMAP 설정에서 IMAP 사용을 켜요.</li>
              <li>네이버 2단계 인증을 켜고 메일용 애플리케이션 비밀번호를 만들어요(진짜 비밀번호는 쓰지 않아요).</li>
              <li>관리자가 Cloudflare 비밀값에 넣어요. 채팅에는 붙여 넣지 마세요.</li>
            </ol>
          </div>
        )}
        {data?.connected && (
          <div className="publish-row" style={{ alignItems: 'center' }}>
            <span className="muted small" style={{ flex: '1 1 200px' }}>{data.synced_at ? `마지막으로 받은 시각 ${when(data.synced_at)}` : '아직 받지 않았어요'} · 15분마다 자동으로 받아요</span>
            <button className="btn" onClick={() => { void sync(); }} disabled={busy !== null}>{busy === 'sync' ? '받는 중…' : '지금 받기'}</button>
          </div>
        )}
        {data?.error && <p className="error small" role="alert" style={{ margin: 0 }}>{data.error}</p>}
      </section>

      <section className="card step" aria-labelledby="mail-list">
        <h2 id="mail-list" className="step-title">받은 메일{data && <span className="step-sub">답장 기다림 {data.waiting}통</span>}</h2>
        <Help short={'AI가 협찬 제안·진행 안내·내 제안에 온 답장을 골라 협찬과 캘린더에 담아요.'}>메일은 본문 앞부분만 90일 동안 두고 지워요. 업체 이름이 같은 협찬이 있으면 그 협찬에 이어 붙이고, 없으면 새로 만들어요. 답장 초안은 AI가 쓰지만 보내기는 읽고 고친 뒤 '보내기'를 누를 때만 돼요.</Help>
        <label className="check" style={{ flex: 'none' }}><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> 기타 메일도 보기</label>
        {data && shown.length === 0 && <p className="muted small" style={{ margin: 0 }}>{data.connected ? '협찬 관련 메일이 아직 없어요.' : '메일을 연결하면 여기에 모여요.'}</p>}
        <ul className="mail-list" aria-label="받은 메일 목록">
          {shown.map(m => {
            const edit = edits[m.id] ?? { subject: m.reply_subject || `Re: ${m.subject}`, body: m.reply_body };
            const canReply = m.status !== 'sent' && m.kind !== 'other';
            return (
              <li key={m.id} className={`mail mail-${m.status}`}>
                <div className="idea-head">
                  <span className={`src${m.kind === 'offer' || m.kind === 'pitch_reply' ? ' s-season' : ''}`}>{KIND[m.kind]}</span>
                  <b className="mail-subject">{m.subject || '(제목 없음)'}</b>
                  {m.status === 'sent' && <span className="badge-ok small">보냄 {m.sent_at ? when(m.sent_at) : ''}</span>}
                  {m.status === 'done' && <span className="muted small">처리 완료</span>}
                </div>
                <span className="muted small">{m.from_name ? `${m.from_name} · ` : ''}{m.from_addr} · {when(m.received_at)}</span>
                {m.summary && <span className="small">{m.summary}</span>}
                {(m.campaign_id || m.deadline) && (
                  <span className="small">
                    {m.campaign_id && <button type="button" className="link-btn" onClick={onCampaigns}>협찬에 담음{m.brand ? `: ${m.brand}` : ''}</button>}
                    {m.deadline && <span className="muted"> · 날짜 {shortDay(m.deadline)}(캘린더에 표시)</span>}
                  </span>
                )}
                <details><summary className="small">메일 본문 보기</summary><p className="mail-body small">{m.snippet}</p></details>
                {canReply && (m.needs_reply > 0 || m.reply_body) && m.status !== 'done' && (
                  <div className="mail-reply">
                    <label className="small" htmlFor={`rs-${m.id}`}>답장 제목</label>
                    <input id={`rs-${m.id}`} className="input" maxLength={200} value={edit.subject} onChange={e => setEdits(x => ({ ...x, [m.id]: { ...edit, subject: e.target.value } }))} />
                    <label className="small" htmlFor={`rb-${m.id}`}>답장 내용</label>
                    <textarea id={`rb-${m.id}`} className="input" rows={7} maxLength={6000} value={edit.body} placeholder="AI 초안이 아직 없어요. 직접 쓰거나 'AI 초안 쓰기'를 눌러 주세요." onChange={e => setEdits(x => ({ ...x, [m.id]: { ...edit, body: e.target.value } }))} />
                    {confirm === m.id ? (
                      <div className="publish-row" role="group" aria-label="보내기 확인">
                        <span className="small" style={{ flex: '1 1 200px' }}><b>{m.from_addr}</b>에게 이 답장을 보낼까요?</span>
                        <button className="btn primary" onClick={() => { void act(m, 'send'); }} disabled={busy !== null}>{busy === `send:${m.id}` ? '보내는 중…' : '보내기 확정'}</button>
                        <button className="btn ghost" onClick={() => setConfirm(null)} disabled={busy !== null}>취소</button>
                      </div>
                    ) : (
                      <div className="idea-actions">
                        <button className="btn primary small" onClick={() => setConfirm(m.id)} disabled={busy !== null || !edit.body.trim() || !data?.connected}>보내기</button>
                        <button className="btn small" onClick={() => { void act(m, 'save'); }} disabled={busy !== null || !edits[m.id]}>저장</button>
                        <button className="btn small" onClick={() => { void act(m, 'draft'); }} disabled={busy !== null}>{busy === `draft:${m.id}` ? '쓰는 중…' : m.reply_body ? 'AI 초안 다시 쓰기' : 'AI 초안 쓰기'}</button>
                        <button className="btn ghost small" onClick={() => { void act(m, 'done'); }} disabled={busy !== null}>답장 안 함</button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </article>
  );
}
