import { useState, type ReactNode } from 'react';
import { Tomong } from './Tomong';

// 빈 화면(Page Flows의 첫 사용 흐름처럼): 한 줄 제목 + 한 줄 설명 + 버튼 하나 + '예시 보기'.
// 예시는 화면에만 보여 주고 저장하지 않는다(내 기록에 가짜 데이터가 섞이지 않게).
export function EmptyState({ title, desc, action, example }: { title: string; desc?: string; action?: { label: string; onClick: () => void }; example?: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div className="empty-state">
      <Tomong kind="minilog" size={48} />
      <b className="empty-title">{title}</b>
      {desc && <p className="muted small empty-desc">{desc}</p>}
      <div className="empty-actions">
        {action && <button type="button" className="btn primary" onClick={action.onClick}>{action.label}</button>}
        {example && <button type="button" className="btn ghost" aria-expanded={show} onClick={() => setShow(v => !v)}>{show ? '예시 닫기' : '예시 보기'}</button>}
      </div>
      {show && example && <div className="empty-example" aria-label="예시(저장되지 않음)"><span className="empty-example-tag">예시 · 저장되지 않아요</span>{example}</div>}
    </div>
  );
}
