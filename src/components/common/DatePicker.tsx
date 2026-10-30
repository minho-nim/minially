import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';
import { formatKoreanDate, getTodayDateString, DAYS_KR } from '../../utils/dateHelpers';

export function DatePicker({ label, value, onChange, placeholder = '날짜를 선택하세요', multiple }: { label: string; value: string; onChange: (date: string) => void; placeholder?: string; multiple?:{values:string[];onToggle:(date:string)=>void;fixed?:string[]} }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number((value || getTodayDateString()).slice(0, 4)));
  const [month, setMonth] = useState(() => Number((value || getTodayDateString()).slice(5, 7)));
  const trigger = useRef<HTMLButtonElement>(null), root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) { const date = value || getTodayDateString(); setYear(Number(date.slice(0, 4))); setMonth(Number(date.slice(5, 7))); } }, [value, open]);
  const close = () => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); };
  const inModal = Boolean(trigger.current?.closest('[aria-modal="true"]'));
  useScheduleDialog(open && !inModal, false, root, close, close, { lockScroll: false, trapFocus: false });
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [open]);
  const moveMonth = (direction: number) => { const next = new Date(year, month - 1 + direction, 1); setYear(next.getFullYear()); setMonth(next.getMonth() + 1); };
  const offset = new Date(year, month - 1, 1).getDay(), count = new Date(year, month, 0).getDate();
  const dateOf = (day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const selectDate=(date:string)=>{if(multiple){if(!multiple.fixed?.includes(date))multiple.onToggle(date);}else{onChange(date);close();}};
  return <div ref={root} className="w-full min-w-0">
    <button ref={trigger} type="button" aria-label={label} aria-description={multiple?`${multiple.values.length}개 날짜 선택됨`:value ? formatKoreanDate(value) : placeholder} aria-expanded={open} onClick={() => setOpen(v => !v)} className="w-full min-h-11 flex items-center gap-2 text-left px-3 py-2.5 bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl text-sm text-[#3E3438]"><Calendar className="w-4 h-4 text-[#CF8FA8] shrink-0" /><span className="min-w-0 break-words">{multiple?`${label} · ${multiple.values.length}일`:value ? formatKoreanDate(value) : placeholder}</span></button>
    {open && <div data-date-picker-open role="group" aria-label={label + ' 달력'} className="mt-2 border border-[#E9CDD8] rounded-xl bg-white p-2 space-y-2">
      <div className="flex items-center gap-1"><button type="button" aria-label={label + ' 이전 달'} onClick={() => moveMonth(-1)} className="min-w-8 px-1 text-[#85777D]"><ChevronLeft className="w-4 h-4" /></button>
        <select autoFocus aria-label={label + ' 연도'} value={String(year)} onChange={e => setYear(Number(e.target.value))} className="min-w-0 flex-1 bg-white text-sm rounded-lg">{Array.from({ length: 151 }, (_, i) => year - 100 + i).map(y => <option key={y} value={String(y)}>{y}</option>)}</select>
        <select aria-label={label + ' 월'} value={String(month)} onChange={e => setMonth(Number(e.target.value))} className="min-w-0 flex-1 bg-white text-sm rounded-lg">{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={String(m)}>{m}월</option>)}</select>
        <button type="button" aria-label={label + ' 다음 달'} onClick={() => moveMonth(1)} className="min-w-8 px-1 text-[#85777D]"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 text-center gap-0.5">{DAYS_KR.map(day => <span key={day} className="text-[10px] text-[#85777D] py-1">{day}</span>)}{Array.from({ length: offset }, (_, i) => <span key={'empty-' + i} />)}{Array.from({ length: count }, (_, i) => i + 1).map(day => { const date = dateOf(day),selected=multiple?multiple.values.includes(date):date===value; return <button key={date} type="button" aria-label={date + ' 선택'} aria-pressed={selected} disabled={multiple?.fixed?.includes(date)} onClick={() => selectDate(date)} className={'min-w-0 rounded-lg text-xs ' + (selected ? 'bg-[#CF8FA8] text-white font-semibold' : date === getTodayDateString() ? 'bg-[#F6E8ED] text-[#AD728B]' : 'text-[#3E3438] hover:bg-[#FFFAFB]')}>{day}</button>; })}</div>
      {multiple&&<p className="text-[11px] text-[#85777D]">날짜를 다시 누르면 선택이 해제됩니다. 기준 날짜는 유지됩니다.</p>}
      <div className="flex gap-2"><button type="button" disabled={multiple?.fixed?.includes(getTodayDateString())} className="flex-1 text-xs text-[#AD728B] rounded-lg bg-[#FFFAFB]" onClick={() => selectDate(getTodayDateString())}>오늘 선택</button><button type="button" data-date-close aria-label={label + ' 달력 닫기'} onClick={close} className="px-3 text-xs text-[#85777D] rounded-lg">닫기</button></div>
    </div>}
  </div>;
}
