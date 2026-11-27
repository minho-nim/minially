import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { findIssues, type Issue } from './bodyIssues';
import { saveUiPrefs, uiPrefs } from './uiPrefs';
import { api } from '../../shared/client/api';

const MODES = [['short', '더 짧게'], ['vivid', '더 생생하게'], ['mine', '내 말투로'], ['info', '정보 위주로']] as const;
type Mode = (typeof MODES)[number][0];

// 본문 칸 + 문제 위치 표시(글쓰기 도구의 밑줄처럼): 본문 뒤에 같은 글을 겹쳐 그려 문제 있는 곳에 물결 밑줄을 긋는다.
// 글은 React 글자로만 그린다(HTML로 넣지 않음). '다음 문제'를 누르면 그 부분을 골라 바로 고칠 수 있다.
const KIND_LABEL: Record<Issue['kind'], string> = { unsure: '확인 필요', money: '보장 표현', spell: '맞춤법', fact: '사실 확인', cliche: '상투 표현', long: '긴 문장', para: '긴 문단' };

/** draftId가 있으면 본문을 골라 '고른 부분만 다시 쓰기'(AI)를 할 수 있다. 바꾼 글은 전/후를 보고 '적용'을 눌러야 들어간다 */
export function BodyEditor({ value, onChange, sources, draftId, canAi = false, onError }: { value: string; onChange: (v: string) => void; sources?: string; draftId?: string; canAi?: boolean; onError?: (text: string) => void }) {
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  const [rw, setRw] = useState<{ start: number; end: number; part: string; mode: Mode; text: string } | null>(null);
  const [rwBusy, setRwBusy] = useState<Mode | null>(null);
  const readSel = () => { const el = ta.current; if (!el) return; setSel(el.selectionEnd - el.selectionStart >= 2 ? { start: el.selectionStart, end: el.selectionEnd } : null); };
  async function rewrite(mode: Mode, range = sel) {
    if (!range || !draftId) return;
    const sel = range;
    const part = value.slice(sel.start, sel.end);
    setRwBusy(mode);
    try {
      const { text } = await api<{ text: string }>(`/api/drafts/${draftId}/rewrite`, { body: { part, mode, before: value.slice(Math.max(0, sel.start - 600), sel.start), after: value.slice(sel.end, sel.end + 600) } });
      setRw({ start: sel.start, end: sel.end, part, mode, text });
    } catch (e) { onError?.(e instanceof Error ? e.message : '다시 쓰지 못했어요.'); }
    finally { setRwBusy(null); }
  }
  function applyRw() {
    if (!rw) return;
    // 그사이 본문을 고쳤으면 고른 글을 다시 찾아 바꾼다(못 찾으면 바꾸지 않음)
    const start = value.slice(rw.start, rw.end) === rw.part ? rw.start : value.indexOf(rw.part);
    if (start < 0) { onError?.('고른 부분이 그사이 바뀌어서 적용하지 못했어요. 다시 골라 주세요.'); setRw(null); return; }
    onChange(value.slice(0, start) + rw.text + value.slice(start + rw.part.length));
    setRw(null); setSel(null);
    const end = start + rw.text.length;
    requestAnimationFrame(() => { ta.current?.focus(); ta.current?.setSelectionRange(start, end); });
  }
  const ta = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(() => { const p = uiPrefs(); if (p) return !p.marks_off; try { return localStorage.getItem('minilog.marks') !== '0'; } catch { return true; } });
  const [at, setAt] = useState(-1);
  // 밑줄 켬/끔은 계정에 기억(다른 기기에서도 같음). 값은 로그인 때 받은 내 정보에 함께 온다
  useEffect(() => { try { localStorage.setItem('minilog.marks', on ? '1' : '0'); } catch { /* 기억 못 해도 됨 */ } }, [on]);
  const toggle = () => { const next = !on; setOn(next); setAt(-1); saveUiPrefs({ marks_off: !next }).catch(() => { /* 다음에 다시 저장 */ }); };
  const issues = useMemo(() => (on ? findIssues(value, sources) : []), [value, sources, on]);
  const cur = at >= 0 && at < issues.length ? issues[at] : null;
  const sync = () => { if (mirror.current && ta.current) { mirror.current.scrollTop = ta.current.scrollTop; mirror.current.scrollLeft = ta.current.scrollLeft; } };
  useEffect(sync, [value, on]);
  const go = (step: number) => {
    if (!issues.length || !ta.current) return;
    // 지금 커서 뒤(앞)의 첫 문제로. 처음 누르면 맨 앞부터
    const pos = ta.current.selectionStart;
    let next = step > 0 ? issues.findIndex(i => i.start > (cur ? cur.start : pos - 1)) : -1;
    if (step < 0) { for (let k = issues.length - 1; k >= 0; k--) if (issues[k].start < (cur ? cur.start : pos)) { next = k; break; } }
    if (next < 0) next = step > 0 ? 0 : issues.length - 1;
    setAt(next);
    const it = issues[next];
    const el = ta.current;
    el.focus();
    el.setSelectionRange(it.start, it.end);
    // 고른 곳이 보이게: 겹친 글에서 그 표시의 위치를 읽어 스크롤
    requestAnimationFrame(() => {
      const mark = mirror.current?.querySelector<HTMLElement>(`[data-i="${next}"]`);
      if (mark) { el.scrollTop = Math.max(0, mark.offsetTop - el.clientHeight / 3); sync(); }
    });
  };
  const parts: ReactNode[] = [];
  let last = 0;
  issues.forEach((it, i) => {
    if (it.start > last) parts.push(<Fragment key={`t${i}`}>{value.slice(last, it.start)}</Fragment>);
    parts.push(<mark key={`m${i}`} data-i={i} className={`issue issue-${it.kind}${i === at ? ' current' : ''}`}>{value.slice(it.start, it.end)}</mark>);
    last = it.end;
  });
  parts.push(<Fragment key="end">{value.slice(last)}{'\n '}</Fragment>);
  return (
    <>
      <div className="issue-bar" aria-live="polite">
        {on && issues.length > 0
          ? <>
              <span className="issue-count">본문에 살펴볼 곳 <b>{issues.length}</b>곳</span>
              <button type="button" className="btn small ghost" onClick={() => go(-1)} aria-label="이전 문제">‹ 이전</button>
              <span className="issue-pos" aria-label="지금 보는 문제">{cur ? `${at + 1} / ${issues.length}` : `– / ${issues.length}`}</span>
              <button type="button" className="btn small" onClick={() => go(1)} aria-label="다음 문제">다음 ›</button>
            </>
          : <span className="muted small">{on ? (value.trim() ? '본문에 표시할 문제가 없어요' : '') : '밑줄 표시를 껐어요'}</span>}
        <button type="button" className="btn small ghost issue-toggle" aria-pressed={on} onClick={toggle}>{on ? '밑줄 끄기' : '밑줄 켜기'}</button>
      </div>
      {cur && <p className={`issue-reason small issue-${cur.kind}`}><b>{KIND_LABEL[cur.kind]}</b> {cur.reason}</p>}
      <div className="body-wrap">
        {on && <div ref={mirror} className="textarea body-input body-mirror" aria-hidden="true">{parts}</div>}
        <textarea id="body" ref={ta} className="textarea body-input" value={value} maxLength={50000} onScroll={sync}
          onSelect={readSel} onChange={e => { onChange(e.target.value); setAt(-1); }} />
      </div>
      {draftId && canAi && !rw && (
        <div className="rewrite-bar" role="group" aria-label="고른 부분 다시 쓰기">
          {sel
            ? <><span className="small">고른 {(sel.end - sel.start).toLocaleString('ko-KR')}자 다시 쓰기</span>
                {MODES.map(([m, label]) => <button key={m} type="button" className="btn small" disabled={!!rwBusy} onMouseDown={e => e.preventDefault()} onClick={() => { void rewrite(m); }}>{rwBusy === m ? '쓰는 중…' : label}</button>)}</>
            : <span className="muted small">본문에서 문장이나 문단을 고르면 그 부분만 AI로 다시 쓸 수 있어요.</span>}
        </div>
      )}
      {rw && (
        <section className="rewrite-compare" aria-label="다시 쓴 글 비교">
          <div className="rw-col"><b className="small">바꾸기 전</b><p className="rw-text">{rw.part}</p></div>
          <div className="rw-col after"><b className="small">바꾼 글 · {MODES.find(x => x[0] === rw.mode)?.[1]}</b><p className="rw-text">{rw.text}</p></div>
          <div className="ai-row rw-actions">
            <button type="button" className="btn primary small" onClick={applyRw}>적용</button>
            <button type="button" className="btn small ghost" onClick={() => { void rewrite(rw.mode, rw); }} disabled={!!rwBusy}>{rwBusy ? '쓰는 중…' : '다시'}</button>
            <button type="button" className="btn small ghost" onClick={() => setRw(null)}>그대로 두기</button>
          </div>
        </section>
      )}
    </>
  );
}
