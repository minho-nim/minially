import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../../shared/client/api';
import { Tomong } from './Tomong';

// AI 채팅(토몽이에게 묻기): 오른쪽 아래 버튼 → 옆 패널(휴대폰은 전체 화면). 원고를 열어 두면 그 원고를 알고 답한다.
interface Message { id: number; role: 'user' | 'model'; text: string; draft_id: string | null; created_at: number }

const DRAFT_ASKS = ['제목 5개 뽑아줘', '이 원고 더 친근하게 다듬어줘', '해시태그 15개 추천해줘', '맞춤법·어색한 곳 찾아줘', '빠진 정보 알려줘(가격·위치·영업시간 등)'];
const GENERAL_ASKS = ['이번 주에 뭐 쓰지?', '조회수 잘 나온 글의 공통점은?', '다음 달 글 계획 짜줘', '협찬 제안 메일 답장 써줘'];

/** 열린 원고 끝에 붙이기(편집 화면이 받아서 저장한다) */
export const insertIntoDraft = (text: string) => window.dispatchEvent(new CustomEvent('minilog:insert', { detail: text }));

export function ChatPanel({ draftId, draftTitle }: { draftId: string | null; draftTitle: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open || messages) return;
    api<{ messages: Message[] }>('/api/chat').then(d => setMessages(d.messages)).catch(e => setError(e instanceof Error ? e.message : '불러오지 못했어요.'));
  }, [open, messages]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages, busy]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true); setError(''); setText('');
    setMessages(m => [...(m ?? []), { id: -Date.now(), role: 'user', text: q, draft_id: draftId, created_at: Date.now() }]);
    try { setMessages((await api<{ messages: Message[] }>('/api/chat', { body: { message: q, draft_id: draftId } })).messages); }
    catch (e) { setError(e instanceof Error ? e.message : '답을 받지 못했어요.'); setMessages(m => (m ?? []).filter(x => x.id > 0)); setText(q); }
    finally { setBusy(false); }
  }

  async function clear() {
    if (!window.confirm('토몽이와 나눈 대화를 모두 지울까요?')) return;
    try { setMessages((await api<{ messages: Message[] }>('/api/chat', { method: 'DELETE' })).messages); } catch (e) { setError(e instanceof Error ? e.message : '지우지 못했어요.'); }
  }

  async function copy(m: Message) {
    try { await navigator.clipboard.writeText(m.text); setCopied(m.id); window.setTimeout(() => setCopied(c => (c === m.id ? null : c)), 1500); }
    catch { setError('복사하지 못했어요. 글을 직접 선택해 복사해 주세요.'); }
  }

  function submit(e: FormEvent) { e.preventDefault(); void ask(text); }
  const asks = draftId ? DRAFT_ASKS : GENERAL_ASKS;

  return (
    <>
      {!open && (
        <button className="chat-fab no-print" onClick={() => setOpen(true)} aria-label="토몽이에게 묻기">
          <Tomong kind="minilog" size={30} /><span>토몽이에게 묻기</span>
        </button>
      )}
      {open && (
        <aside className="chat-panel no-print" role="dialog" aria-label="토몽이에게 묻기">
          <header className="chat-head">
            <Tomong kind="minilog" size={28} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <b>토몽이에게 묻기</b>
              <p className="muted small chat-context">{draftId ? `열어 둔 원고: ${draftTitle || '제목 없는 원고'}` : '내 블로그 숫자·일정을 알고 대답해요'}</p>
            </div>
            {messages && messages.length > 0 && <button className="btn ghost small" onClick={() => { void clear(); }}>지우기</button>}
            <button className="btn ghost small" onClick={() => setOpen(false)} aria-label="채팅 닫기">✕</button>
          </header>
          <div className="chat-list" ref={listRef} aria-live="polite">
            {messages === null && !error && <p className="muted small">불러오는 중…</p>}
            {messages?.length === 0 && <p className="muted small chat-empty">아래 질문을 누르거나 직접 물어보세요. 대화는 나만 봐요.</p>}
            {messages?.map(m => (
              <div key={m.id} className={`chat-msg ${m.role}`}>
                <p>{m.text}</p>
                {m.role === 'model' && (
                  <div className="chat-actions">
                    <button className="btn ghost small" onClick={() => { void copy(m); }}>{copied === m.id ? '복사됨 ✓' : '복사'}</button>
                    {draftId && <button className="btn ghost small" onClick={() => insertIntoDraft(m.text)}>원고 끝에 넣기</button>}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="chat-msg model busy" role="status"><Tomong kind="minilog" size={22} bounce /><span className="hand">생각하는 중이에요</span></div>}
          </div>
          {error && <p className="error small" role="alert" style={{ margin: '0 12px' }}>{error}</p>}
          <div className="chat-asks" role="group" aria-label="자주 묻는 질문">
            {asks.map(a => <button key={a} className="chip-btn" onClick={() => { void ask(a); }} disabled={busy}>{a}</button>)}
          </div>
          <form className="chat-form" onSubmit={submit}>
            <label htmlFor="chat-input" className="sr-only">토몽이에게 물어볼 내용</label>
            <textarea id="chat-input" ref={inputRef} className="textarea" rows={2} maxLength={2000} value={text} placeholder="물어보세요(Enter 보내기, Shift+Enter 줄바꿈)"
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(text); } }} />
            <button className="btn primary" type="submit" disabled={busy || !text.trim()}>보내기</button>
          </form>
        </aside>
      )}
    </>
  );
}
