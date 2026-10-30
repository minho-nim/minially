import { CheckCircle2 } from 'lucide-react';

export function RegistrationNotice({message,title}:{message:string;title:string}) {
  return <div role="status" aria-label="등록 완료 알림" aria-live="polite" aria-atomic="true" className="fixed left-1/2 -translate-x-1/2 z-[80] pointer-events-none w-[calc(100%-24px)] max-w-md rounded-2xl border border-[#DBAEC1] bg-[#FFF7FA] shadow-lg px-4 py-3 flex gap-2.5 text-[#754359]" style={{top:'max(12px, env(safe-area-inset-top, 0px))'}}>
    <CheckCircle2 aria-hidden="true" className="w-5 h-5 shrink-0 mt-0.5"/>
    <div className="min-w-0"><p className="text-sm font-bold">{message}</p><p className="text-xs mt-0.5 line-clamp-2 break-words">{title}</p></div>
  </div>;
}
