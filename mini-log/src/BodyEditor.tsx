import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { findIssues, type Issue } from './bodyIssues';

// 본문 칸 + 문제 위치 표시(글쓰기 도구의 밑줄처럼): 본문 뒤에 같은 글을 겹쳐 그려 문제 있는 곳에 물결 밑줄을 긋는다.
// 글은 React 글자로만 그린다(HTML로 넣지 않음). '다음 문제'를 누르면 그 부분을 골라 바로 고칠 수 있다.
const KIND_LABEL: Record<Issue['kind'], string> = { unsure: '확인 필요', money: '보장 표현', fact: '사실 확인', cliche: '상투 표현', long: '긴 문장', para: '긴 문단' };

export function BodyEditor({ value, onChange, sources }: { value: string; onChange: (v: string) => void; sources?: string }) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(() => { try { return localStorage.getItem('minilog.marks') !== '0'; } catch { return true; } });
  const [at, setAt] = useState(-1);
  useEffect(() => { try { localStorage.setItem('minilog.marks', on ? '1' : '0'); } catch { /* 기억 못 해도 됨 */ } }, [on]);
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
        <button type="button" className="btn small ghost issue-toggle" aria-pressed={on} onClick={() => { setOn(v => !v); setAt(-1); }}>{on ? '밑줄 끄기' : '밑줄 켜기'}</button>
      </div>
      {cur && <p className={`issue-reason small issue-${cur.kind}`}><b>{KIND_LABEL[cur.kind]}</b> {cur.reason}</p>}
      <div className="body-wrap">
        {on && <div ref={mirror} className="textarea body-input body-mirror" aria-hidden="true">{parts}</div>}
        <textarea id="body" ref={ta} className="textarea body-input" value={value} maxLength={50000} onScroll={sync}
          onChange={e => { onChange(e.target.value); setAt(-1); }} />
      </div>
    </>
  );
}
