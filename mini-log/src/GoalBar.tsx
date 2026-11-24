import { useState } from 'react';
import { api, formatNumber } from '../../shared/client/api';

// 이번 달 수익 목표: 받은 금액(진하게) + 받을 금액(옅게)을 목표 대비 막대로
export function GoalBar({ goal, paid, pending, month, onChange }: { goal: number | null; paid: number; pending: number; month: number; onChange: (g: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(goal ? String(goal) : '');
  const [error, setError] = useState('');
  async function save(value: number | null) {
    setError('');
    try { const r = await api<{ monthly: number | null }>('/api/goal', { method: 'PUT', body: { monthly: value } }); onChange(r.monthly); setEditing(false); }
    catch (e) { setError(e instanceof Error ? e.message : '저장하지 못했어요.'); }
  }
  if (editing || goal === null) {
    if (!editing) return <button className="btn ghost small" style={{ justifySelf: 'start' }} onClick={() => setEditing(true)}>🎯 {month}월 수익 목표 정하기</button>;
    return (
      <form className="goal-form" onSubmit={e => { e.preventDefault(); const n = Number(text.replace(/[,\s원]/g, '')); if (!Number.isFinite(n)) { setError('숫자로 적어 주세요.'); return; } void save(Math.round(n)); }}>
        <label htmlFor="goal-input" className="small">한 달 목표(원)</label>
        <input id="goal-input" className="input small-input" inputMode="numeric" value={text} placeholder="예: 300000" onChange={e => setText(e.target.value)} />
        <button className="btn small primary" type="submit">저장</button>
        <button className="btn ghost small" type="button" onClick={() => setEditing(false)}>취소</button>
        {goal !== null && <button className="btn ghost small" type="button" onClick={() => { void save(null); }}>목표 지우기</button>}
        {error && <p className="error small" role="alert" style={{ margin: 0, flexBasis: '100%' }}>{error}</p>}
      </form>
    );
  }
  const pct = Math.round((paid / goal) * 100);
  const paidW = Math.min(100, (paid / goal) * 100);
  const pendW = Math.min(100 - paidW, (pending / goal) * 100);
  const left = Math.max(0, goal - paid);
  return (
    <div className="goal" aria-label={`${month}월 목표 ${formatNumber(goal)}원 중 ${pct}%`}>
      <div className="row-between">
        <span className="small"><b>🎯 목표 {pct}%</b> <span className="muted">· {formatNumber(goal)}원 중</span></span>
        <button className="btn ghost small" onClick={() => { setText(String(goal)); setEditing(true); }}>바꾸기</button>
      </div>
      <div className="goal-track" aria-hidden="true">
        <span className="goal-paid" style={{ width: `${paidW}%` }} />
        <span className="goal-pending" style={{ width: `${pendW}%` }} />
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {left === 0 ? '이번 달 목표를 채웠어요!' : `${formatNumber(left)}원 남았어요${pending ? ` · 받을 금액까지 더하면 ${Math.round(((paid + pending) / goal) * 100)}%` : ''}`}
      </p>
    </div>
  );
}
