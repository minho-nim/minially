import {useState} from 'react';
import {createPortal} from 'react-dom';
import { CheckCircle2, X, RotateCcw } from 'lucide-react';
import {formatKoreanDate,DAYS_KR} from '../../utils/dateHelpers';

export interface RegistrationNoticeData {id:string;message:string;title:string;dates:string[];startTime?:string;endTime?:string;kind?:'schedule'|'task';undoId?:string;}
export function RegistrationNotice({notice,onDismiss,onUndo,container}:{notice:RegistrationNoticeData;onDismiss?:()=>void;onUndo?:()=>Promise<void>;container?:HTMLElement|null}) {
  const [pending,setPending]=useState(false);
  const time=notice.startTime?[notice.startTime,notice.endTime].filter(Boolean).join(' ~ '):notice.kind==='task'?'시간 미지정':'종일';
  const first=notice.dates[0],parts=first?.split('-').map(Number);
  const compactDate=parts?parts[1]+'/'+parts[2]+(notice.dates.length>1?' 외 '+(notice.dates.length-1)+'일':'('+DAYS_KR[new Date(parts[0],parts[1]-1,parts[2]).getDay()]+')'):'';
  return createPortal(<div role="status" aria-label="등록 완료 알림" aria-live="polite" aria-atomic="true" style={{top:'max(12px, env(safe-area-inset-top, 0px))'}} className="fixed left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-24px)] max-w-sm shadow-lg rounded-2xl border border-[#DBAEC1] bg-[#FFF7FA] px-2.5 py-2 flex items-center gap-2 text-[#754359]">
    <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5 shrink-0"/>
    <div className="min-w-0 flex-1"><p className="sr-only">{notice.message}</p><div className="flex items-center gap-1.5 text-[11px] leading-4 whitespace-nowrap"><span aria-label="등록 날짜" className="min-w-0 truncate"><span className="sr-only">{notice.dates.map(formatKoreanDate).join(' · ')}</span><span aria-hidden="true">{compactDate}</span></span><span aria-hidden="true">·</span><span aria-label="등록 시간" className="shrink-0">{time}</span></div><p aria-label="등록 제목" title={notice.title} className="text-xs leading-[18px] font-semibold truncate">{notice.title}</p></div>
    <div className="flex items-center gap-0.5 shrink-0">{onUndo&&<button type="button" aria-label={pending?'처리 중…':'실행 취소'} title="실행 취소" disabled={pending} onClick={async()=>{if(pending)return;setPending(true);try{await onUndo();}finally{setPending(false);}}} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F6E8ED] disabled:opacity-50"><RotateCcw className="w-3.5 h-3.5"/></button>}{onDismiss&&<button type="button" aria-label="등록 알림 닫기" disabled={pending} onClick={onDismiss} className="w-7 h-8 flex items-center justify-center rounded-lg hover:bg-[#F6E8ED]"><X className="w-3.5 h-3.5"/></button>}</div>
  </div>,container||document.body);
}
