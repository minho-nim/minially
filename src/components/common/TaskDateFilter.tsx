import React, { useEffect, useRef, useState } from 'react';
import { CalendarRange, X } from 'lucide-react';
import { DatePicker } from './DatePicker';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';
import { formatShortDate, getTodayDateString } from '../../utils/dateHelpers';

export function TaskDateFilter({ start, end, onChange }: { start: string; end: string; onChange: (start: string, end: string) => void }) {
  const [open,setOpen]=useState(false),[range,setRange]=useState(false),[from,setFrom]=useState(start),[to,setTo]=useState(end);
  const root=useRef<HTMLDivElement>(null);
  const close=()=>setOpen(false);
  useScheduleDialog(open,false,root,close,close);
  useEffect(()=>{if(open){setFrom(start);setTo(end);setRange(start!==end);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>('header button')?.focus());}},[open]);
  const format=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const shortcut=(kind:'today'|'week'|'month')=>{
    const a=new Date(),b=new Date(a);
    if(kind==='week'){a.setDate(a.getDate()-((a.getDay()+6)%7));b.setTime(a.getTime());b.setDate(b.getDate()+6);}
    if(kind==='month'){a.setDate(1);b.setMonth(b.getMonth()+1,0);}
    setFrom(kind==='today'?getTodayDateString():format(a));setTo(kind==='today'?getTodayDateString():format(b));setRange(kind!=='today');
  };
  return <><button type="button" aria-label="할 일 날짜 선택" aria-haspopup="dialog" onClick={()=>setOpen(true)} className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-lg border border-app-line bg-white px-2 text-xs text-app-ink"><CalendarRange aria-hidden="true" className="h-4 w-4 shrink-0"/><span>{start===end?start:formatShortDate(start)+' ~ '+formatShortDate(end)}</span></button>
    {open&&<div ref={root} role="dialog" aria-modal="true" aria-label="할 일 날짜 및 기간 선택" className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]" onClick={e=>{if(e.target===e.currentTarget)close();}}><section className="w-full max-w-sm max-h-[min(80dvh,var(--modal-height,100dvh))] overflow-y-auto rounded-2xl border border-app-line bg-white p-3 space-y-2">
      <header className="flex items-center justify-between"><h2 className="text-sm font-bold">날짜·기간 조회</h2><button type="button" aria-label="날짜 기간 선택 닫기" onClick={close} className="min-h-9 min-w-9 flex items-center justify-center"><X className="h-4 w-4"/></button></header>
      <div role="group" aria-label="조회 방식" className="flex gap-1">{[['하루',false],['기간',true]].map(([label,value])=><button key={String(label)} type="button" aria-pressed={range===value} onClick={()=>{setRange(Boolean(value));if(!value)setTo(from);}} className={'min-h-8 rounded-lg px-3 text-xs '+(range===value?'bg-app-soft text-app-accent-hover':'text-app-muted')}>{label}</button>)}</div>
      <DatePicker label={range?'조회 시작일':'조회 날짜'} value={from} onChange={date=>{setFrom(date);if(!range)setTo(date);}}/>
      {range&&<DatePicker label="조회 종료일" value={to} onChange={setTo}/>}
      {range&&from>to&&<p role="alert" className="text-xs text-red-600">종료일은 시작일 이후로 선택해 주세요.</p>}
      <div className="flex flex-wrap gap-1">{[['오늘','today'],['이번 주','week'],['이번 달','month']].map(([label,kind])=><button key={kind} type="button" onClick={()=>shortcut(kind as 'today'|'week'|'month')} className="min-h-8 rounded-lg border border-app-line px-2 text-xs">{label}</button>)}</div>
      <div className="flex justify-end"><button type="button" disabled={!from||!to||(range&&from>to)} onClick={()=>{onChange(from,range?to:from);close();}} className="min-h-8 rounded-lg bg-app-accent px-4 text-xs text-white disabled:opacity-40">조회</button></div>
    </section></div>}
  </>;
}
