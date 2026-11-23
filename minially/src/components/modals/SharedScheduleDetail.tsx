import React, { useEffect, useRef } from 'react';
import { X, Users } from 'lucide-react';
import type { Schedule } from '../../types';
import { formatKoreanDate } from '../../utils/dateHelpers';

// 공유 받은 일정 보기(읽기 전용)
export const SharedScheduleDetail: React.FC<{ schedule: Schedule | null; owner: string; color?: string; onClose: () => void }> = ({ schedule, owner, color, onClose }) => {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!schedule) return;
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', esc, true);
    return () => document.removeEventListener('keydown', esc, true);
  }, [schedule, onClose]);
  if (!schedule) return null;
  const time = schedule.startTime ? `${schedule.startTime}${schedule.endTime ? ` ~ ${schedule.endTime}` : ''}` : '시간 미지정';
  return (
    <div role="dialog" aria-modal="true" aria-label="공유 받은 일정" className="app-modal fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-app-line p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-app-muted"><span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} /><Users className="w-3.5 h-3.5" />{owner}의 일정</p>
          <button ref={ref} type="button" aria-label="닫기" onClick={onClose} className="p-1.5 rounded-lg text-app-muted hover:bg-app-soft cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <h3 className={`text-base font-bold text-app-ink ${schedule.completed ? 'line-through text-app-muted' : ''}`}>{schedule.isImportant ? '★ ' : ''}{schedule.title}</h3>
        <dl className="text-sm space-y-1">
          <div className="flex gap-2"><dt className="w-10 text-app-muted">날짜</dt><dd>{formatKoreanDate(schedule.date)}</dd></div>
          <div className="flex gap-2"><dt className="w-10 text-app-muted">시간</dt><dd>{time}</dd></div>
          {schedule.memo && <div className="flex gap-2"><dt className="w-10 shrink-0 text-app-muted">메모</dt><dd className="whitespace-pre-wrap break-words">{schedule.memo}</dd></div>}
        </dl>
        <p className="text-[11px] text-app-muted">공유 받은 일정은 볼 수만 있어요.</p>
      </div>
    </div>
  );
};
