import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useScheduleDialog} from '../../hooks/useScheduleDialog';
import {getNoteVersions,type NoteVersion} from '../../db/indexedDB';

// 메모 수정 기록: 바뀌기 전 내용(이 기기에만 보관, 메모당 최근 30개)을 보고 그 버전으로 되돌린다.
const REASON:Record<NoteVersion['reason'],string>={edit:'고치기 전',sync:'다른 기기에서 바뀌기 전',restore:'되돌리기 전'};
const when=(ms:number)=>new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(ms);

export function NoteHistoryDialog({noteId,currentBody,onClose,onRestore}:{noteId:string|null;currentBody:string;onClose:()=>void;onRestore:(version:NoteVersion)=>Promise<void>}){
 const root=useRef<HTMLDivElement>(null),closeRef=useRef<HTMLButtonElement>(null);
 const [versions,setVersions]=useState<NoteVersion[]|null>(null),[picked,setPicked]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const close=()=>{if(busy)return false;onClose();};
 useScheduleDialog(noteId!==null,false,root,close,close);
 useEffect(()=>{if(!noteId)return;setVersions(null);setPicked(null);setError('');closeRef.current?.focus();getNoteVersions(noteId).then(list=>{setVersions(list);setPicked(list[0]?.id??null);}).catch(()=>setError('수정 기록을 불러오지 못했습니다.'));},[noteId]);
 if(!noteId)return null;
 const version=versions?.find(v=>v.id===picked);
 const diff=version?version.note.body.length-currentBody.length:0;
 async function restore(){if(!version||busy)return;setBusy(true);setError('');try{await onRestore(version);onClose();}catch(e){setError(e instanceof Error?e.message:'되돌리지 못했습니다.');}finally{setBusy(false);}}
 return createPortal(<div ref={root} role="dialog" aria-modal="true" aria-label="메모 수정 기록" className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]" onClick={event=>{if(event.target===event.currentTarget)close();}}>
  <div className="w-full max-w-2xl max-h-[85dvh] bg-white rounded-2xl border border-app-line shadow-lg text-app-ink flex flex-col overflow-hidden">
   <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-app-line"><div><h2 className="text-sm font-bold">수정 기록</h2><p className="text-[11px] text-app-muted">고치기 전 내용을 이 기기에 남겨요(메모당 최근 30개, 10분 안의 연속 수정은 한 번으로).</p></div><button ref={closeRef} type="button" aria-label="수정 기록 닫기" disabled={busy} onClick={close} className="shrink-0 whitespace-nowrap min-h-9 px-3 rounded-lg text-sm hover:bg-app-soft">닫기</button></div>
   {error&&<p role="alert" className="px-4 pt-2 text-xs text-red-600">{error}</p>}
   {versions===null&&!error&&<p role="status" className="px-4 py-6 text-xs text-app-muted">불러오는 중…</p>}
   {versions?.length===0&&<p className="px-4 py-6 text-xs text-app-muted">아직 수정 기록이 없어요. 메모를 고치면 고치기 전 내용이 여기에 남아요.</p>}
   {versions&&versions.length>0&&<div className="grid md:grid-cols-[200px_minmax(0,1fr)] min-h-0 flex-1">
    <ul aria-label="버전 목록" className="overflow-y-auto border-b md:border-b-0 md:border-r border-app-line max-h-40 md:max-h-none">{versions.map(v=><li key={v.id}><button type="button" aria-pressed={v.id===picked} onClick={()=>setPicked(v.id)} className={'w-full text-left px-3 py-2 min-h-11 text-xs border-b border-app-line/60 '+(v.id===picked?'bg-app-soft font-semibold':'hover:bg-app-soft/60')}><span className="block">{when(v.savedAt)}</span><span className="block text-[11px] text-app-muted">{REASON[v.reason]} · {v.note.title||'제목 없는 메모'}</span></button></li>)}</ul>
    {version&&<div className="flex flex-col min-h-0"><div className="px-4 py-2 border-b border-app-line text-xs text-app-muted">{when(version.savedAt)} · {REASON[version.reason]} · 지금보다 {diff===0?'글자 수 같음':`${Math.abs(diff).toLocaleString('ko-KR')}자 ${diff>0?'많음':'적음'}`}</div>
     <div aria-label="선택한 버전 내용" className="px-4 py-3 overflow-y-auto flex-1 min-h-32"><h3 className="text-sm font-bold mb-2 break-words">{version.note.title||'제목 없는 메모'}</h3><p className="text-sm whitespace-pre-wrap break-words leading-6">{version.note.body||'(내용 없음)'}</p></div>
     <div className="px-4 py-3 border-t border-app-line flex items-center justify-end gap-2"><span className="text-[11px] text-app-muted mr-auto">되돌려도 지금 내용은 기록에 남아요.</span><button type="button" disabled={busy} onClick={()=>void restore()} className="shrink-0 whitespace-nowrap min-h-10 px-3 rounded-lg text-sm bg-app-accent text-white disabled:opacity-50">{busy?'되돌리는 중…':'이 버전으로 되돌리기'}</button></div></div>}
   </div>}
  </div>
 </div>,document.body);
}
