import {useState} from 'react';
import {ChevronLeft,ChevronRight,X} from 'lucide-react';
import {DAYS_KR,formatKoreanDate,getTodayDateString} from '../../utils/dateHelpers';

function dateRange(start:string,end:string) {
 const values:string[]=[],day=new Date(start+'T12:00:00'),last=new Date(end+'T12:00:00');
 while(day<=last){values.push(day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0'));day.setDate(day.getDate()+1);}
 return values;
}

export function MultipleDateSelection({baseDate,dates,onChange,onDone}:{baseDate:string;dates:string[];onChange:(baseDate:string,dates:string[])=>void;onDone:()=>void}) {
 const initial=baseDate||getTodayDateString();
 const [mode,setMode]=useState<'dates'|'range'>('dates');
 const [year,setYear]=useState(()=>Number(initial.slice(0,4))),[month,setMonth]=useState(()=>Number(initial.slice(5,7)));
 const [rangeStart,setRangeStart]=useState<string|null>(null);
 const selected=rangeStart?[rangeStart]:dates;
 const changeDates=(next:string[])=>{const sorted=[...new Set(next)].sort();onChange(sorted[0]||'',sorted);};
 const moveMonth=(step:number)=>{const next=new Date(year,month-1+step,1);setYear(next.getFullYear());setMonth(next.getMonth()+1);};
 const select=(date:string)=>{
  if(mode==='dates'){changeDates(dates.includes(date)?dates.filter(value=>value!==date):[...dates,date]);return;}
  if(!rangeStart){setRangeStart(date);return;}
  const [start,end]=[rangeStart,date].sort();changeDates(dateRange(start,end));setRangeStart(null);
 };
 const days=new Date(year,month,0).getDate(),offset=new Date(year,month-1,1).getDay();
 return <div className="space-y-3">
  <div role="group" aria-label="여러 날짜 선택 방식" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F6E8ED]">
   {(['dates','range'] as const).map(value=><button key={value} type="button" aria-pressed={mode===value} onClick={()=>{if(value!==mode){setMode(value);setRangeStart(null);}}} className={'min-h-11 rounded-lg text-sm '+(mode===value?'bg-white text-[#8F526C] font-semibold shadow-2xs':'text-[#85777D]')}>{value==='dates'?'날짜 여러 개':'시작일~종료일'}</button>)}
  </div>
  <p role="status" className="text-xs text-[#85777D] min-h-4">{mode==='dates'?'원하는 날짜를 누르세요. 다시 누르면 해제됩니다.':rangeStart?formatKoreanDate(rangeStart)+' 시작 · 종료일을 누르세요.':'시작일과 종료일을 차례로 누르세요. 같은 날을 두 번 누르면 하루만 선택됩니다.'}</p>
  <div role="group" aria-label="등록 날짜 달력" className="border border-[#E9CDD8] rounded-xl bg-white p-2 space-y-2">
   <div className="flex items-center gap-1"><button type="button" aria-label="등록 날짜 이전 달" onClick={()=>moveMonth(-1)} className="w-9 min-h-11 shrink-0 flex items-center justify-center rounded-lg hover:bg-[#F6E8ED]"><ChevronLeft className="w-4 h-4"/></button><select aria-label="등록 날짜 연도" value={year} onChange={event=>setYear(Number(event.target.value))} className="min-w-0 flex-1 bg-white text-sm min-h-11">{Array.from({length:151},(_,index)=>year-100+index).map(value=><option key={value} value={value}>{value}년</option>)}</select><select aria-label="등록 날짜 월" value={month} onChange={event=>setMonth(Number(event.target.value))} className="min-w-0 flex-1 bg-white text-sm min-h-11">{Array.from({length:12},(_,index)=>index+1).map(value=><option key={value} value={value}>{value}월</option>)}</select><button type="button" aria-label="등록 날짜 다음 달" onClick={()=>moveMonth(1)} className="w-9 min-h-11 shrink-0 flex items-center justify-center rounded-lg hover:bg-[#F6E8ED]"><ChevronRight className="w-4 h-4"/></button></div>
   <div className="grid grid-cols-7 gap-0.5 text-center">{DAYS_KR.map(day=><span key={day} className="text-[11px] text-[#85777D] py-1">{day}</span>)}{Array.from({length:offset},(_,index)=><span key={'empty-'+index}/>)}{Array.from({length:days},(_,index)=>index+1).map(day=>{const date=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'),active=selected.includes(date),edge=mode==='dates'||date===selected[0]||date===selected[selected.length-1];return <button key={date} type="button" aria-label={date+' 선택'} aria-pressed={active} aria-current={date===getTodayDateString()?'date':undefined} onClick={()=>select(date)} className={'min-w-0 min-h-11 rounded-lg text-sm '+(active?(edge?'bg-[#CF8FA8] text-white font-semibold':'bg-[#F6E8ED] text-[#8F526C]'):date===getTodayDateString()?'ring-1 ring-inset ring-[#CF8FA8] text-[#8F526C]':'text-[#3E3438] hover:bg-[#FFFAFB]')}>{day}</button>;})}</div>
  </div>
  <p className="text-xs font-semibold">선택한 날짜 {selected.length}일</p>
  {mode==='range'&&selected.length>0?<p aria-label="선택한 날짜" className="text-xs text-[#754359]">{formatKoreanDate(selected[0])}{selected.length>1?' ~ '+formatKoreanDate(selected[selected.length-1]):''}</p>:<div aria-label="선택한 날짜" className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto overscroll-contain">{dates.map(date=><span key={date} className="inline-flex items-center gap-1 px-2 bg-[#FFFAFB] border border-[#F0E7EB] rounded-lg text-xs min-h-8">{date}<button type="button" className="min-h-8 min-w-6 flex items-center justify-center" aria-label={date+' 선택 해제'} onClick={()=>changeDates(dates.filter(item=>item!==date))}><X className="w-3 h-3"/></button></span>)}</div>}
  <button type="button" disabled={!selected.length} onClick={()=>{if(rangeStart)changeDates([rangeStart]);onDone();}} className="w-full min-h-11 rounded-xl bg-[#CF8FA8] text-white text-sm font-semibold disabled:opacity-40">{selected.length}일 선택 완료</button>
 </div>;
}
