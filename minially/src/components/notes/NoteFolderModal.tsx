import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import type {CategoryItem,NoteFolder} from '../../types';
import {useScheduleDialog} from '../../hooks/useScheduleDialog';

interface Props {noteCount:number;onDelete:(id:string)=>Promise<void>;open:boolean;folder?:NoteFolder;categories:CategoryItem[];onClose:()=>void;onSave:(folder:NoteFolder)=>Promise<void>}
export function NoteFolderModal({noteCount,onDelete,open,folder,categories,onClose,onSave}:Props){
 const root=useRef<HTMLDivElement>(null),nameInput=useRef<HTMLInputElement>(null);
 const [confirmDelete,setConfirmDelete]=useState(false),[name,setName]=useState(''),[keywords,setKeywords]=useState(''),[category,setCategory]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 // 같은 창을 다시 열면 작성 중인 내용을 유지하고, 다른 분류를 열 때만 바꾼다.
 useEffect(()=>{setName(folder?.name??'');setKeywords(folder?.keywords.join(', ')??'');setCategory(folder?.defaultCategoryId??'');setError('');setConfirmDelete(false);},[folder?.id]);
 useEffect(()=>{if(!open)return;const frame=requestAnimationFrame(()=>nameInput.current?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame);},[open]);
 const close=()=>{if(busy)return false;onClose();};
 useScheduleDialog(open,false,root,close,close);
 async function save(){
  if(busy||!name.trim())return;setBusy(true);setError('');
  try{await onSave({id:folder?.id||crypto.randomUUID(),name:name.trim(),keywords:keywords.split(',').map(word=>word.trim()).filter(Boolean),defaultCategoryId:category||undefined});if(!folder){setName('');setKeywords('');setCategory('');}onClose();}
  catch(e){setError(e instanceof Error?e.message:'분류를 저장하지 못했습니다. 다시 시도해 주세요.');}
  finally{setBusy(false);}
 }
 async function remove(){if(!folder||busy)return;setBusy(true);setError('');try{await onDelete(folder.id);onClose();}catch(e){setError(e instanceof Error?e.message:'분류를 삭제하지 못했습니다.');}finally{setBusy(false);}}
 if(!open)return null;
 return createPortal(<div ref={root} role="dialog" aria-modal="true" aria-label={folder?'메모 분류 수정':'메모 분류 추가'} data-dismiss-on-backdrop className="app-modal note-folder-overlay fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]" onClick={event=>{if(event.target===event.currentTarget)close();}}>
  <div className="note-folder-card w-full max-w-sm max-h-[calc(var(--modal-height,100dvh)-32px)] rounded-2xl border border-app-line bg-white text-app-ink shadow-xl flex flex-col overflow-hidden">
   <header className="px-3 py-2 border-b border-app-line flex items-center justify-between shrink-0"><h2 className="text-sm font-bold">{folder?'분류 수정':'분류 추가'}</h2><button type="button" aria-label="메모 분류 닫기" disabled={busy} onClick={close} className="w-9 h-9 flex items-center justify-center rounded-lg text-app-muted hover:bg-app-soft"><X className="w-4 h-4"/></button></header>
   <form aria-label={folder?'메모 분류 수정':'메모 분류 추가'} className="min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3" onSubmit={event=>{event.preventDefault();void save();}}>
    <label className="block text-xs font-medium">분류 이름<input ref={nameInput} aria-label="분류 이름" autoComplete="off" required maxLength={80} disabled={busy} value={name} onChange={event=>setName(event.target.value)} placeholder="예: 독서 기록" className="w-full min-w-0 mt-1 px-3 py-2 text-base rounded-lg border border-app-line bg-app-canvas outline-none"/></label>
    <label className="block text-xs font-medium">추천 키워드<input aria-label="추천 키워드" disabled={busy} value={keywords} onChange={event=>setKeywords(event.target.value)} placeholder="쉼표로 구분: 책, 독후감" className="w-full min-w-0 mt-1 px-3 py-2 text-base rounded-lg border border-app-line bg-app-canvas outline-none"/></label>
    <label className="block text-xs font-medium">기본 카테고리<select aria-label="폴더 기본 카테고리" disabled={busy} value={category} onChange={event=>setCategory(event.target.value)} className="w-full min-w-0 mt-1 px-3 py-2 text-base rounded-lg border border-app-line bg-app-canvas"><option value="">선택 안 함</option>{categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <p className="text-[11px] text-app-muted leading-5">키워드는 분류 추천에, 기본 카테고리는 할 일·일정 등록에 사용해요.</p>
    {folder&&<div className="border-t border-app-line pt-2">{confirmDelete?<div role="group" aria-label="분류 삭제 확인" className="space-y-2"><p className="text-xs leading-5">‘{folder.name}’ 분류를 삭제할까요? 메모 {noteCount}개는 미분류로 옮겨지고 내용은 유지됩니다. 휴지통 메모도 포함됩니다.</p><div className="flex gap-2"><button type="button" disabled={busy} onClick={()=>setConfirmDelete(false)} className="min-h-9 px-3 text-xs border border-app-line rounded-lg">유지</button><button type="button" disabled={busy} onClick={()=>void remove()} className="min-h-9 px-3 text-xs bg-app-soft text-app-accent-hover rounded-lg">분류 삭제</button></div></div>:<button type="button" disabled={busy} aria-label="메모 분류 삭제" onClick={()=>setConfirmDelete(true)} className="min-h-9 px-2 text-xs text-app-muted hover:text-app-accent-hover">분류 삭제</button>}</div>}
    {error&&<p role="alert" className="text-xs text-red-600">{error}</p>}
    <div className="flex justify-end"><button type="submit" disabled={busy||!name.trim()} className="min-h-9 px-4 rounded-lg bg-app-accent text-white text-xs font-semibold disabled:opacity-50">{busy?'저장 중…':'분류 저장'}</button></div>
   </form>
  </div>
 </div>,document.body);
}
