import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Plus,X} from 'lucide-react';
import type {CategoryItem,ChecklistItem,Note,Task} from '../../types';
import {DatePicker} from '../common/DatePicker';
import {useScheduleDialog} from '../../hooks/useScheduleDialog';

export type NoteTaskOptions=Pick<Task,'priority'|'checklist'>;
export interface NoteTaskSource {note:Note;date:string;categoryId:string;excerpt?:string}
interface Props {source:NoteTaskSource|null;categories:CategoryItem[];onClose:()=>void;onSave:(source:NoteTaskSource,options:NoteTaskOptions)=>Promise<void>}
const field='w-full min-w-0 mt-1 min-h-9 px-2 py-1.5 rounded-lg border border-app-line bg-app-canvas text-base outline-none focus:border-app-accent';
export function NoteTaskModal({source,categories,onClose,onSave}:Props){
 const root=useRef<HTMLDivElement>(null),titleInput=useRef<HTMLInputElement>(null),saving=useRef(false);
 const [title,setTitle]=useState(''),[date,setDate]=useState(''),[category,setCategory]=useState(''),[priority,setPriority]=useState<Task['priority']>('medium'),[memo,setMemo]=useState(''),[checklist,setChecklist]=useState<ChecklistItem[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const close=()=>{if(saving.current)return false;onClose();};
 useScheduleDialog(!!source,false,root,close,close);
 useEffect(()=>{if(!source)return;setTitle(source.note.title);setDate(source.date);setCategory(source.categoryId);setPriority('medium');setMemo(source.note.body);setChecklist([]);setError('');const frame=requestAnimationFrame(()=>titleInput.current?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame);},[source]);
 async function save(){if(!source||saving.current||!title.trim()||!date)return;saving.current=true;setBusy(true);setError('');try{await onSave({...source,note:{...source.note,title:title.trim(),body:memo},date,categoryId:category},{priority,checklist:checklist.filter(item=>item.text.trim()).map(item=>({...item,text:item.text.trim()}))});onClose();}catch(e){setError(e instanceof Error?e.message:'할 일을 등록하지 못했습니다. 다시 시도해 주세요.');}finally{saving.current=false;setBusy(false);}}
 if(!source)return null;
 return createPortal(<div ref={root} role="dialog" aria-modal="true" aria-label="메모에서 할 일 등록" className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]" onClick={event=>{if(event.target===event.currentTarget)close();}}><div className="w-full max-w-md max-h-[calc(var(--modal-height,100dvh)-32px)] rounded-2xl border border-app-line bg-white text-app-ink shadow-xl flex flex-col overflow-hidden">
  <header className="px-3 py-2 border-b border-app-line flex justify-between items-center"><h2 className="text-sm font-bold">할 일로 등록</h2><button type="button" aria-label="할 일 등록 닫기" disabled={busy} onClick={close} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-app-soft"><X size={16}/></button></header>
  <form className="min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3" onSubmit={event=>{event.preventDefault();void save();}}>
   <fieldset disabled={busy} className="space-y-3 min-w-0">
    <label className="block text-xs">제목<input ref={titleInput} aria-label="할 일 제목" required maxLength={500} value={title} onChange={event=>setTitle(event.target.value)} className={field}/></label>
    <DatePicker label="할 일 날짜" value={date} onChange={setDate}/>
    <div className="grid grid-cols-2 gap-2"><label className="min-w-0 text-xs">카테고리<select aria-label="할 일 카테고리" value={category} onChange={event=>setCategory(event.target.value)} className={field}><option value="">미분류</option>{categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="min-w-0 text-xs">우선순위<select aria-label="할 일 우선순위" value={priority} onChange={event=>setPriority(event.target.value as Task['priority'])} className={field}><option value="low">낮음</option><option value="medium">보통</option><option value="high">높음</option></select></label></div>
    <label className="block text-xs">메모<textarea aria-label="할 일 메모" value={memo} onChange={event=>setMemo(event.target.value)} rows={3} className={field+' resize-y'}/></label>
    <div className="space-y-1.5"><div className="flex justify-between items-center text-xs"><span>체크리스트</span><button type="button" disabled={checklist.length>=100} onClick={()=>setChecklist(items=>[...items,{id:crypto.randomUUID(),text:'',done:false}])} className="min-h-8 px-2 rounded-lg text-app-accent-hover hover:bg-app-soft inline-flex items-center gap-1"><Plus size={14}/>항목 추가</button></div>{checklist.map((item,index)=><div key={item.id} className="flex gap-2 items-center"><input type="checkbox" aria-label={`체크리스트 ${index+1} 완료`} checked={item.done} onChange={event=>setChecklist(items=>items.map(value=>value.id===item.id?{...value,done:event.target.checked}:value))}/><input aria-label={`체크리스트 ${index+1}`} maxLength={500} value={item.text} onChange={event=>setChecklist(items=>items.map(value=>value.id===item.id?{...value,text:event.target.value}:value))} className={field+' !mt-0'}/><button type="button" aria-label={`체크리스트 ${index+1} 삭제`} onClick={()=>setChecklist(items=>items.filter(value=>value.id!==item.id))} className="shrink-0 w-8 h-9 flex items-center justify-center rounded-lg text-app-muted hover:bg-app-soft"><X size={14}/></button></div>)}</div>
   </fieldset>
   <p className="text-[11px] text-app-muted">{source.excerpt?'선택한 내용':'메모 전체'}를 바탕으로 등록해요. 원본 메모는 유지돼요.</p>
   {error&&<p role="alert" className="text-xs text-red-600">{error}</p>}
   <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={close} className="min-h-9 px-3 rounded-lg text-xs text-app-muted hover:bg-app-soft">취소</button><button type="submit" disabled={busy||!title.trim()||!date} className="min-h-9 px-4 rounded-lg bg-app-accent text-white text-xs font-semibold disabled:opacity-50">{busy?'등록 중…':'등록'}</button></div>
  </form>
 </div></div>,document.body);
}
