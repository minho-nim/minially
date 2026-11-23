import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Task } from '../../types';
import { DatePicker } from '../common/DatePicker';
import { getTodayDateString } from '../../utils/dateHelpers';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';

interface Props {
  task: Task | null; importing: boolean; tasks: Task[]; onClose: () => void;
  onSaveDate: (id: string, date: string) => Promise<void>;
}
export function TaskPlanningModal({ task, importing, tasks, onClose, onSaveDate }: Props) {
  const root = useRef<HTMLDivElement>(null), busy = useRef(false);
  const [date, setDate] = useState(''), [pending, setPending] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const open = Boolean(task) || importing;
  const close = () => { if (busy.current) return false; onClose(); };
  useScheduleDialog(open, false, root, close, close);
  useEffect(() => { if (open) { setDate(task?.dueDate || getTodayDateString()); setError(''); setMessage(''); requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('header button')?.focus()); } }, [open, task?.id]);
  if (!open) return null;
  const today = getTodayDateString();
  const previous = tasks.filter(item => item.status !== 'done' && (!item.dueDate || item.dueDate < today)).sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||''));
  const save = async (item: Task, target: string) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await onSaveDate(item.id, target); if (importing) setMessage('‘' + item.title + '’을 오늘로 가져왔습니다.'); else onClose(); }
    catch { setError('날짜를 변경하지 못했습니다. 다시 시도해 주세요.'); }
    finally { busy.current = false; setPending(false); }
  };
  const tomorrow = () => { const day = new Date(); day.setDate(day.getDate()+1); return `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`; };
  return <div ref={root} role="dialog" aria-modal="true" aria-label={importing ? '미완료 할 일 가져오기' : '할 일 날짜 변경'} className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]" onClick={e=>{if(e.target===e.currentTarget)close();}}>
    <section className="w-full max-w-md max-h-[min(80dvh,var(--modal-height,100dvh))] flex flex-col overflow-hidden rounded-2xl border border-app-line bg-white text-app-ink shadow-xl">
      <header className="flex shrink-0 items-center justify-between px-3 py-2 border-b border-app-line"><h2 className="text-sm font-bold">{importing ? '미완료 할 일 가져오기' : '날짜 변경'}</h2><button type="button" aria-label="할 일 날짜 팝업 닫기" onClick={close} disabled={pending} className="min-h-9 min-w-9 flex items-center justify-center"><X className="h-5 w-5"/></button></header>
      <div className="min-h-0 overflow-y-auto p-3 space-y-2">
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}{message && <p role="status" className="text-xs text-app-accent-hover">{message}</p>}
        {importing ? <><p className="text-xs text-app-muted">미완료 할 일을 오늘로 옮깁니다.</p>{!previous.length && <p className="py-2 text-center text-xs text-app-muted">가져올 미완료 할 일이 없습니다.</p>}{previous.map(item=><div key={item.id} className="flex flex-wrap items-center gap-2 border border-app-line rounded-lg p-2"><div className="flex-1 min-w-0 basis-32"><p className="text-sm break-words">{item.title}</p><p className="text-[11px] text-app-muted">{item.dueDate || '날짜 없음'}</p></div><button type="button" disabled={pending} aria-label={item.title+' 오늘로 가져오기'} onClick={()=>void save(item,today)} className="min-h-8 shrink-0 rounded-lg bg-app-soft text-xs text-app-accent-hover px-2">오늘로 가져오기</button></div>)}</> : task && <><p className="text-sm break-words">{task.title}</p><DatePicker label="옮길 날짜" value={date} onChange={setDate}/><div className="flex flex-wrap gap-1.5">{[['오늘',today],['내일',tomorrow()]].map(([label,value])=><button key={label} type="button" disabled={pending} onClick={()=>setDate(value)} className="min-h-8 rounded-lg border border-app-line px-2 text-xs">{label}</button>)}</div><div className="flex justify-end gap-1.5"><button type="button" disabled={pending} onClick={close} className="min-h-8 px-3 text-xs text-app-muted">취소</button><button type="button" disabled={pending || date===(task.dueDate||'')} onClick={()=>void save(task,date)} className="min-h-8 rounded-lg bg-app-accent px-3 text-xs text-white disabled:opacity-40">{pending?'저장 중':'날짜 저장'}</button></div></>}
      </div>
    </section>
  </div>;
}
