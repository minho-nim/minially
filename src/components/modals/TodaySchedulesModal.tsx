import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, X, Clock, Check } from 'lucide-react';
import type { CategoryItem, Schedule, Task, RecurrenceRule, RecurrenceException } from '../../types';
import { getTodayDateString, formatKoreanDate } from '../../utils/dateHelpers';
import { compareSchedules } from '../../utils/scheduleOrder';
import { calendarSchedulesForDate, hasCalendarTask } from '../../utils/calendarTasks';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';

interface Props {
  open: boolean; onClose: () => void; schedules: Schedule[]; categories: CategoryItem[]; tasks: Task[];
  rules: RecurrenceRule[]; exceptions: RecurrenceException[];
  onRegisterTask: (schedule: Schedule) => Promise<void>;
}
export function TodaySchedulesModal({ open, onClose, schedules, categories, tasks, rules, exceptions, onRegisterTask }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [today, setToday] = useState(getTodayDateString);
  const close = () => { if (busy.current) return false; onClose(); };
  useScheduleDialog(open, false, root, close, close);
  useEffect(() => {
    if (!open) return;
    setError(''); setMessage('');
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('header button')?.focus());
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      setToday(getTodayDateString());
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 100);
      timer = setTimeout(update, Math.max(1000, next.getTime() - now.getTime()));
    };
    const resume = () => { if (!document.hidden) { clearTimeout(timer); update(); } };
    update();
    document.addEventListener('visibilitychange', resume);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', resume); };
  }, [open]);
  const items = useMemo(() => open ? calendarSchedulesForDate(schedules, rules, exceptions, today).sort(compareSchedules) : [], [open, schedules, rules, exceptions, today]);
  if (!open) return null;
  const register = async (schedule: Schedule) => {
    if (busy.current) return;
    busy.current = true; setPendingId(schedule.id); setError(''); setMessage('');
    try { await onRegisterTask(schedule); setMessage('‘' + schedule.title + '’을 할 일에 등록했습니다.'); }
    catch { setError('할 일에 등록하지 못했습니다. 다시 시도해 주세요.'); }
    finally { busy.current = false; setPendingId(null); }
  };
  return <div ref={root} role="dialog" aria-modal="true" aria-label="오늘 캘린더 일정" className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]" onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <section className="w-full max-w-lg max-h-[min(80dvh,var(--modal-height,100dvh))] rounded-2xl border border-app-line bg-white text-app-ink shadow-xl flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center gap-2 border-b border-app-line px-3 py-2">
        <Calendar aria-hidden="true" className="w-4 h-4 text-app-accent" />
        <div className="min-w-0 flex-1"><h2 className="text-sm font-bold">오늘 일정</h2><p className="text-[11px] text-app-muted">{formatKoreanDate(today)} · {items.length}개</p></div>
        <button type="button" aria-label="오늘 일정 닫기" disabled={pendingId !== null} onClick={close} className="min-h-9 min-w-9 rounded-lg flex items-center justify-center text-app-muted hover:bg-app-soft"><X className="w-5 h-5" /></button>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-3 space-y-2">
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        {message && <p role="status" className="text-xs text-app-accent-hover">{message}</p>}
        {!items.length && <p className="py-2 text-center text-xs text-app-muted">오늘 등록된 일정이 없습니다.</p>}
        {items.map(schedule => {
          const category = categories.find(item => item.id === schedule.category);
          const added = hasCalendarTask(tasks, schedule);
          return <article key={schedule.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-app-line p-2">
            <div className="min-w-0 flex-1 basis-36">
              <p className={'break-words text-sm ' + (schedule.completed ? 'text-app-muted line-through' : 'text-app-ink')}>{schedule.isImportant && '★ '}{schedule.title}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-app-muted">
                <span className="inline-flex items-center gap-1"><Clock aria-hidden="true" className="h-3 w-3" />{schedule.startTime ? schedule.startTime + (schedule.endTime ? ' ~ ' + schedule.endTime : '') : '종일'}</span>
                <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{background:category?.color || '#BAAFB4'}} />{category?.name || '미분류'}</span>
              </div>
            </div>
            <button type="button" aria-label={schedule.title + ' 할 일에 등록'} disabled={added || pendingId !== null} onClick={() => void register(schedule)} className="ml-auto min-h-8 shrink-0 whitespace-nowrap rounded-lg bg-app-soft px-2 text-xs text-app-accent-hover disabled:opacity-50 inline-flex items-center gap-1">{added && <Check aria-hidden="true" className="h-3 w-3" />}{added ? '등록됨' : pendingId === schedule.id ? '등록 중' : '할 일에 등록'}</button>
          </article>;
        })}
      </div>
    </section>
  </div>;
}
