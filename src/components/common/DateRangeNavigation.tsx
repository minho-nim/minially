import { shiftTaskDateRange } from '../../utils/taskDateRange';
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DatePicker } from './DatePicker';
import { getTodayDateString } from '../../utils/dateHelpers';

const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function DateRangeNavigation({ start, end, onChange, label = '할 일 날짜 및 기간 선택', previousLabel = '이전 날짜 할 일', nextLabel = '다음 날짜 할 일', dateLabel = '조회 날짜' }: { start: string; end: string; onChange: (start: string, end: string) => void; label?: string; previousLabel?: string; nextLabel?: string; dateLabel?: string }) {
  const [range, setRange] = useState(start !== end);
  const previous = useRef({start,end});
  useEffect(() => {
    if (start !== end) setRange(true);
    else if (previous.current.start !== previous.current.end) setRange(false);
    previous.current = {start,end};
  }, [start, end]);
  const today = getTodayDateString();
  const shift = (direction: number) => onChange(...shiftTaskDateRange(start, end, direction));
  const shortcut = (kind: 'week' | 'month') => {
    const a = new Date(), b = new Date(a);
    if (kind === 'week') { a.setDate(a.getDate() - ((a.getDay() + 6) % 7)); b.setTime(a.getTime()); b.setDate(b.getDate() + 6); }
    else { a.setDate(1); b.setMonth(b.getMonth() + 1, 0); }
    setRange(true);
    onChange(format(a), format(b));
  };
  return <section aria-label={label} className="min-w-0 space-y-1.5">
    <div className="flex flex-wrap items-center gap-1">
      <div role="group" aria-label="조회 방식" className="inline-flex rounded-lg bg-app-soft p-0.5 text-xs">
        {(['하루', '기간'] as const).map((label, index) => <button key={label} type="button" aria-pressed={range === Boolean(index)} onClick={() => { setRange(Boolean(index)); if (!index) onChange(start, start); }} className={'min-h-8 rounded-md px-2.5 ' + (range === Boolean(index) ? 'bg-white font-semibold text-app-ink' : 'text-app-muted')}>{label}</button>)}
      </div>
      <button type="button" onClick={() => shortcut('week')} className="min-h-8 rounded-lg px-2 text-xs text-app-muted hover:bg-app-soft">이번 주</button>
      <button type="button" onClick={() => shortcut('month')} className="min-h-8 rounded-lg px-2 text-xs text-app-muted hover:bg-app-soft">이번 달</button>
    </div>
    <div role="group" aria-label={label + ' 탐색'} className="flex min-w-0 items-start gap-1">
      <button type="button" aria-label={previousLabel} onClick={() => shift(-1)} className="flex min-h-9 shrink-0 items-center rounded-lg px-1 hover:bg-app-soft"><ChevronLeft aria-hidden="true" className="h-4 w-4"/></button>
      <div className={"grid min-w-0 flex-1 gap-1.5 " + (range ? "grid-cols-2" : "grid-cols-1")}>
        <DatePicker compact={range} label={range ? '조회 시작일' : dateLabel} value={start} onChange={date => onChange(date, range && date <= end ? end : date)}/>
        {range && <DatePicker compact label="조회 종료일" value={end} onChange={date => onChange(date < start ? date : start, date)}/>}
      </div>
      <button type="button" aria-label={nextLabel} onClick={() => shift(1)} className="flex min-h-9 shrink-0 items-center rounded-lg px-1 hover:bg-app-soft"><ChevronRight aria-hidden="true" className="h-4 w-4"/></button>
      <button type="button" aria-pressed={start === today && end === today} onClick={() => { setRange(false); onChange(today, today); }} className="min-h-9 shrink-0 rounded-lg px-2 text-xs text-app-accent hover:bg-app-soft">오늘</button>
    </div>
  </section>;
}
