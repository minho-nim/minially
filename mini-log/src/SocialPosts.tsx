// 다른 곳에도 올리기: 원고 하나로 스레드·X 짧은 글을 만들고, 복사하거나 글이 채워진 작성 화면을 연다.
// 앱이 대신 게시하지 않는다(게시 버튼은 사람이 그 앱에서 누른다). X 공식 API는 유료라 쓰지 않는다.
import { useState } from 'react';
import { api } from '../../shared/client/api';
import { composeUrl, THREADS_LIMIT, threadsText, X_LIMIT, xLength, xText } from './publishKit';

export function SocialPosts({ draftId, title, body, hashtags, url, beforeAi, onMessage }: {
  draftId: string; title: string; body: string; hashtags: string[]; url: string;
  /** AI 요청 전에 원고를 먼저 저장 */
  beforeAi: () => Promise<void>;
  onMessage: (m: { kind: 'info' | 'error'; text: string }) => void;
}) {
  const link = /^https:\/\//.test(url.trim()) ? url.trim() : '';
  const [threads, setThreads] = useState<string | null>(null);
  const [x, setX] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = threads !== null;

  async function ai() {
    await beforeAi();
    setBusy(true);
    try {
      const r = await api<{ threads: string; x: string }>(`/api/drafts/${draftId}/social`, { body: {} });
      setThreads(threadsText(title, body, hashtags, link, r.threads || undefined));
      setX(xText(title, body, hashtags, link, r.x || undefined));
      onMessage({ kind: 'info', text: 'AI가 스레드·X 글을 짧게 다듬었어요. 고친 뒤 복사하거나 앱에서 열어 올리세요.' });
    } catch (e) { onMessage({ kind: 'error', text: e instanceof Error ? e.message : '짧은 글을 만들지 못했어요.' }); }
    finally { setBusy(false); }
  }
  async function copy(text: string, where: string) {
    try { await navigator.clipboard.writeText(text); onMessage({ kind: 'info', text: `${where} 글을 복사했어요.` }); }
    catch { onMessage({ kind: 'error', text: '복사하지 못했어요. 글을 직접 선택해 복사해 주세요.' }); }
  }

  const row = (where: 'threads' | 'x', label: string, value: string, set: (v: string) => void, over: boolean, count: string) => (
    <div className="insta-box" key={where}>
      <label htmlFor={`social-${where}`}>{label}</label>
      <textarea id={`social-${where}`} className="textarea" rows={where === 'x' ? 3 : 6} value={value} onChange={e => set(e.target.value)} />
      <div className="kit-buttons">
        <button className="btn small" onClick={() => { void copy(value, label); }} disabled={!value.trim()}>{label} 글 복사</button>
        <a className={`btn small${over || !value.trim() ? ' disabled' : ''}`} aria-disabled={over || !value.trim()} href={over || !value.trim() ? undefined : composeUrl(where, value)} target="_blank" rel="noopener noreferrer">{label}에서 열기 ↗</a>
        <span className={`small ${over ? 'error' : 'muted'}`}>{count}</span>
      </div>
    </div>
  );

  return <>
    <div className="kit-buttons">
      <button className="btn small" aria-expanded={open} onClick={() => { if (open) { setThreads(null); setX(null); } else { setThreads(threadsText(title, body, hashtags, link)); setX(xText(title, body, hashtags, link)); } }}>{open ? '스레드·X 글 닫기' : '스레드·X 글 만들기'}</button>
      {open && <button className="btn small" onClick={() => { void ai(); }} disabled={busy || body.trim().length < 20}>{busy ? '쓰는 중…' : 'AI로 짧게 다듬기'}</button>}
      <span className="muted small">앱이 대신 올리지 않아요. '…에서 열기'는 글이 채워진 작성 화면을 열고, 올리기는 직접 눌러요.{link ? '' : ' 게시한 글 주소를 넣으면 끝에 붙여요.'}</span>
    </div>
    {threads !== null && row('threads', '스레드', threads, setThreads, threads.length > THREADS_LIMIT, `${threads.length.toLocaleString('ko-KR')} / ${THREADS_LIMIT}자`)}
    {x !== null && row('x', 'X', x, setX, xLength(x) > X_LIMIT, `${xLength(x)} / ${X_LIMIT}(한글은 2로 셈)`)}
  </>;
}
