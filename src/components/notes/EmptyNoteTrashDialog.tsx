import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useScheduleDialog} from '../../hooks/useScheduleDialog';

export function EmptyNoteTrashDialog({count,onClose,onEmpty,selectionOnly=false}:{count:number|null;selectionOnly?:boolean;onClose:()=>void;onEmpty:()=>Promise<void>}){
 const root=useRef<HTMLDivElement>(null),cancel=useRef<HTMLButtonElement>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const close=()=>{if(busy)return false;onClose();};
 useScheduleDialog(count!==null,false,root,close,close);
 useEffect(()=>{if(count!==null){setError('');cancel.current?.focus();}},[count]);
 async function empty(){if(busy)return;setBusy(true);setError('');try{await onEmpty();}catch{setError('휴지통을 비우지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false);}}
 if(count===null)return null;
 return createPortal(<div ref={root} role="dialog" aria-modal="true" aria-label={selectionOnly?'선택 메모 영구 삭제 확인':'메모 휴지통 비우기 확인'} aria-describedby="empty-note-trash-description" className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]" onClick={event=>{if(event.target===event.currentTarget)close();}}>
  <div className="w-full max-w-sm rounded-2xl bg-white p-4 border border-app-line shadow-xl text-app-ink">
   <h2 className="text-sm font-bold">{selectionOnly?'선택한 메모를 영구 삭제할까요?':'휴지통을 비울까요?'}</h2>
   <p id="empty-note-trash-description" className="text-sm mt-2 leading-6">{selectionOnly?'선택한':'휴지통의'} 메모 {count}개를 영구 삭제합니다. 삭제한 메모는 복구할 수 없습니다.</p>
   <p className="text-xs text-app-muted mt-2">{selectionOnly?'선택하지 않은 메모와 연결된 할 일·일정은 유지됩니다.':'검색 결과와 관계없이 휴지통 전체가 대상입니다. 연결된 할 일과 일정은 유지됩니다.'}</p>
   {error&&<p role="alert" className="text-xs text-red-600 mt-3">{error}</p>}
   <div className="flex justify-end gap-2 mt-4"><button ref={cancel} type="button" disabled={busy} onClick={close} className="min-h-10 px-3 rounded-lg text-sm hover:bg-app-soft disabled:opacity-50">취소</button><button type="button" disabled={busy} onClick={()=>void empty()} className="min-h-10 px-3 rounded-lg text-sm bg-app-accent text-white disabled:opacity-50">{busy?'비우는 중…':'영구 삭제'}</button></div>
  </div>
 </div>,document.body);
}
