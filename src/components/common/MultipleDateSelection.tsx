import {useState} from 'react';
import {X} from 'lucide-react';
import {DatePicker} from './DatePicker';

function dateRange(start:string,end:string) {
 const values:string[]=[],day=new Date(start+'T12:00:00'),last=new Date(end+'T12:00:00');
 while(day<=last){values.push(day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0'));day.setDate(day.getDate()+1);}
 return values;
}

export function MultipleDateSelection({baseDate,dates,onChange}:{baseDate:string;dates:string[];onChange:(baseDate:string,dates:string[])=>void}) {
 const [mode,setMode]=useState<'dates'|'range'>('dates');
 const [start,setStart]=useState(dates[0]||baseDate),[end,setEnd]=useState(dates[dates.length-1]||baseDate);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const changeMode=(next:typeof mode)=>{setMode(next);setError('');setMessage('');if(next==='range'){setStart(dates[0]||baseDate);setEnd(dates[dates.length-1]||baseDate);}};
 const apply=(first=start,last=end)=>{
  if(!first||!last){setError('시작일과 종료일을 선택하세요.');return;}
  if(last<first){setError('종료일은 시작일과 같거나 이후 날짜로 선택하세요.');return;}
  const next=dateRange(first,last);onChange(first,next);setStart(first);setEnd(last);setError('');setMessage(next.length+'일의 기간을 적용했습니다.');
 };
 return <div className="space-y-3">
  <div role="group" aria-label="여러 날짜 선택 방식" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F6E8ED]">
   {(['dates','range'] as const).map(value=><button key={value} type="button" aria-pressed={mode===value} onClick={()=>changeMode(value)} className={'min-h-11 rounded-lg text-sm '+(mode===value?'bg-white text-[#8F526C] font-semibold shadow-2xs':'text-[#85777D]')}>{value==='dates'?'날짜별 선택':'기간 선택'}</button>)}
  </div>
  {mode==='dates'?<div className="space-y-2"><p className="text-xs text-[#85777D]">달력에서 원하는 날짜를 하나씩 누르세요. 다시 누르면 선택이 해제됩니다.</p><DatePicker label="직접 선택" value={baseDate} onChange={()=>{}} multiple={{values:dates,fixed:[baseDate],onToggle:selected=>{onChange(baseDate,dates.includes(selected)?dates.filter(date=>date!==selected):[...dates,selected].sort());setMessage('');}}}/></div>:<div className="space-y-3">
   <p className="text-xs text-[#85777D]">시작일과 종료일을 포함한 모든 날짜를 선택합니다. 적용하면 현재 선택한 날짜를 이 기간으로 바꿉니다.</p>
   <div><p className="text-xs font-semibold mb-1">시작일</p><DatePicker label="기간 시작일" value={start} onChange={value=>{setStart(value);setError('');setMessage('');}}/></div>
   <div><p className="text-xs font-semibold mb-1">종료일</p><DatePicker label="기간 종료일" value={end} onChange={value=>{setEnd(value);setError('');setMessage('');}}/></div>
   {error&&<p role="alert" className="text-xs text-[#C4476B]">{error}</p>}
   <button type="button" onClick={()=>apply()} className="w-full min-h-11 rounded-xl bg-[#CF8FA8] text-white text-sm font-semibold">기간 적용</button>
   <div className="grid grid-cols-3 gap-1">{[3,5,7].map(count=><button key={count} type="button" className="min-h-11 text-xs rounded-lg bg-[#F6E8ED] text-[#8F526C]" onClick={()=>{const last=new Date(baseDate+'T12:00:00');last.setDate(last.getDate()+count-1);apply(baseDate,last.getFullYear()+'-'+String(last.getMonth()+1).padStart(2,'0')+'-'+String(last.getDate()).padStart(2,'0'));}}>기준일부터 {count}일 선택</button>)}</div>
  </div>}
  {message&&<p role="status" className="text-xs text-[#8F526C]">{message}</p>}
  <p className="text-xs font-semibold">선택한 날짜 {dates.length}일</p>
  <div aria-label="선택한 날짜" className="flex flex-wrap gap-2 max-h-36 overflow-y-auto overscroll-contain">{dates.map(date=><span key={date} className="inline-flex items-center gap-1 px-2 bg-[#FFFAFB] border border-[#F0E7EB] rounded-lg text-xs min-h-9">{date}{date===baseDate?<span className="text-[10px] text-[#AD728B]">기준일</span>:<button type="button" className="min-h-9 min-w-7 flex items-center justify-center" aria-label={date+' 선택 해제'} onClick={()=>{onChange(baseDate,dates.filter(item=>item!==date));setMessage('');}}><X className="w-3.5 h-3.5"/></button>}</span>)}</div>
 </div>;
}
