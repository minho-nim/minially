import {RichNoteBody} from './RichNoteBody';
import {useEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeft, CheckSquare, CalendarPlus, FileText, Folder, Plus, Search, Pin, Trash2, Maximize2, Minimize2, RotateCcw} from 'lucide-react';
import type {Note, NoteFolder, Task, CategoryItem, Schedule} from '../../types';
import {noteTitle, recommendNoteFolders} from '../../utils/notes';
import {getTodayDateString} from '../../utils/dateHelpers';

interface Props {
 schedules:Schedule[]; onOpenTask:(id:string)=>void; onOpenSchedule:(id:string)=>void;
 categories:CategoryItem[]; notes:Note[]; folders:NoteFolder[]; tasks:Task[]; openNoteId?:string;
 onSave:(note:Note)=>Promise<void>; onSaveFolder:(folder:NoteFolder)=>Promise<void>;
 onTask:(note:Note,date:string,categoryId:string)=>Promise<void>; onSchedule:(note:Note,categoryId:string,date:string)=>Promise<void>;
}
const button='inline-flex items-center justify-center gap-1.5 min-h-9 px-2.5 rounded-lg text-xs hover:bg-app-soft transition-colors disabled:opacity-50 cursor-pointer';
const field='w-full min-w-0 px-3 py-2 text-sm rounded-lg border border-app-line bg-white outline-none focus:border-app-accent';
export function NotesView({schedules,onOpenTask,onOpenSchedule,categories,notes,folders,tasks,onSave,onSaveFolder,onTask,onSchedule,openNoteId}:Props){
 const [filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[selected,setSelected]=useState<string|null>(null),[focus,setFocus]=useState(false),[mobileEditor,setMobileEditor]=useState(false);
 const [quick,setQuick]=useState(''),[quickFolder,setQuickFolder]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [newFolder,setNewFolder]=useState(false),[folderName,setFolderName]=useState(''),[keywords,setKeywords]=useState(''),[editingFolder,setEditingFolder]=useState<string|null>(null),[defaultCategory,setDefaultCategory]=useState('');
 useEffect(()=>{if(openNoteId){setSelected(openNoteId);setMobileEditor(true);}},[openNoteId]);
 const recommendations=recommendNoteFolders(quick,folders);
 const visible=useMemo(()=>notes.filter(note=>filter==='trash'?!!note.deletedAt:!note.deletedAt&&(filter==='all'||(filter==='pinned'?note.pinned:note.folderId===filter))).filter(note=>(note.title+' '+note.body+' '+note.tags.join(' ')).toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updatedAt-a.updatedAt),[notes,filter,query]);
 const current=notes.find(note=>note.id===selected);
 async function create(){if(busy)return;setBusy(true);setError('');const now=Date.now();const note:Note={id:crypto.randomUUID(),title:'',body:quick,folderId:quickFolder,tags:[],pinned:false,createdAt:now,updatedAt:now};try{await onSave(note);setSelected(note.id);setMobileEditor(true);setFilter('all');setQuick('');setQuickFolder('');}catch(e){setError(e instanceof Error?e.message:'메모를 저장하지 못했습니다.');}finally{setBusy(false);}}
 return <section aria-label="메모장" className={'notes-workspace rounded-2xl border border-app-line bg-white overflow-hidden '+(focus?'notes-focus':'')}>
  <aside aria-label="메모 분류" className={'notes-folders bg-app-canvas border-r border-app-line p-3 '+(mobileEditor?'hidden md:block':'')}>
   <h1 className="text-base font-bold px-2 py-2 flex items-center gap-2"><FileText className="w-4 h-4 text-app-accent"/>메모</h1>
   <div className="flex md:flex-col gap-1 flex-wrap">
    {[['all','모든 메모'],['pinned','고정 메모'],...folders.map(folder=>[folder.id,folder.name]),['trash','휴지통']].map(([id,label])=><button key={id} type="button" aria-pressed={filter===id} onClick={()=>{setFilter(id);setSelected(null);}} className={button+' justify-start text-left min-w-0 '+(filter===id?'bg-app-soft text-app-accent-hover font-semibold':'text-app-muted')}><Folder className="w-3.5 h-3.5 shrink-0"/><span className="truncate">{label}</span><span className="ml-auto text-[10px]">{notes.filter(note=>id==='trash'?!!note.deletedAt:!note.deletedAt&&(id==='all'||(id==='pinned'?note.pinned:note.folderId===id))).length}</span></button>)}
   </div>
   <button type="button" className={button+' mt-3 text-app-accent-hover'} onClick={()=>{setNewFolder(!newFolder);setEditingFolder(null);setFolderName('');setKeywords('');setDefaultCategory('');}}><Plus className="w-3.5 h-3.5"/>분류 추가</button>
   {folders.some(folder=>folder.id===filter)&&<button type="button" className={button+' text-app-muted'} onClick={()=>{const folder=folders.find(item=>item.id===filter)!;setEditingFolder(folder.id);setFolderName(folder.name);setKeywords(folder.keywords.join(', '));setDefaultCategory(folder.defaultCategoryId||'');setNewFolder(true);}}>폴더 설정</button>}
   {newFolder&&<form aria-label="메모 분류 추가" className="space-y-2 mt-2" onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{await onSaveFolder({id:editingFolder||crypto.randomUUID(),defaultCategoryId:defaultCategory||undefined,name:folderName.trim(),keywords:keywords.split(',').map(word=>word.trim()).filter(Boolean)});setFolderName('');setKeywords('');setNewFolder(false);}catch(e){setError(e instanceof Error?e.message:'분류를 저장하지 못했습니다.');}finally{setBusy(false);}}}><input className={field} aria-label="분류 이름" placeholder="분류 이름" required maxLength={80} value={folderName} onChange={e=>setFolderName(e.target.value)}/><input className={field} aria-label="추천 키워드" placeholder="키워드: 회의, 보고서" value={keywords} onChange={e=>setKeywords(e.target.value)}/><label className="block text-xs text-app-muted">기본 카테고리<select aria-label="폴더 기본 카테고리" className={field+' mt-1'} value={defaultCategory} onChange={e=>setDefaultCategory(e.target.value)}><option value="">선택 안 함</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button disabled={busy||!folderName.trim()} className={button+' bg-app-soft text-app-accent-hover'}>분류 저장</button></form>}
   <p className="hidden md:block mt-5 px-2 text-[11px] leading-5 text-app-muted">편하게 적고 정리하세요.<br/>내용에 맞는 분류를 추천해요.</p>
  </aside>
  <section aria-label="메모 목록" className={'notes-list border-r border-app-line min-w-0 flex flex-col '+(mobileEditor?'hidden md:flex':'')}>
   <div className="p-2 space-y-1.5 border-b border-app-line">
    <div className="flex items-center gap-2"><Search className="w-4 h-4 text-app-muted"/><input type="search" className="w-full min-w-0 text-sm py-1.5 outline-none" aria-label="메모 검색" placeholder="메모 검색" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <form aria-label="빠른 메모" onSubmit={event=>{event.preventDefault();void create();}}>
     <textarea aria-label="빠른 메모 내용" placeholder="생각나는 대로 적으세요…" rows={2} className={field+' resize-none bg-app-canvas'} value={quick} onChange={e=>{setQuick(e.target.value);setQuickFolder('');}} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();void create();}}}/>
     <div className="flex flex-wrap items-center gap-1 mt-1">{recommendations.map(folder=><button key={folder.id} type="button" aria-pressed={quickFolder===folder.id} className={button+' min-h-7 px-2 '+(quickFolder===folder.id?'bg-app-soft text-app-accent-hover':'text-app-muted')} onClick={()=>setQuickFolder(quickFolder===folder.id?'':folder.id)}>#{folder.name}</button>)}</div>
     <div className="flex justify-between items-center mt-1"><span className="text-[10px] text-app-muted">Ctrl+Enter로 저장</span><button disabled={busy} className={button+' bg-app-accent text-white hover:bg-app-accent-hover'}><Plus className="w-3.5 h-3.5"/>{quick.trim()?'메모 저장':'새 메모'}</button></div>
    </form>
   </div>
   <div className="overflow-y-auto flex-1 min-h-32 p-2 space-y-1">
    {!visible.length&&<p className="text-xs text-app-muted px-3 py-5">{filter==='trash'?'휴지통이 비어 있습니다.':query?'검색 결과가 없습니다.':'첫 메모를 편하게 남겨 보세요.'}</p>}
    {visible.map(note=><button key={note.id} type="button" data-note-id={note.id} aria-pressed={selected===note.id} onClick={()=>{setSelected(note.id);setMobileEditor(true);}} className={'w-full text-left rounded-lg px-2.5 py-2 border transition-colors '+(selected===note.id?'border-app-outline bg-app-soft':'border-transparent hover:bg-app-canvas')}><div className="flex gap-1 items-center"><span className="text-sm font-semibold truncate min-w-0 flex-1">{noteTitle(note)}</span>{note.pinned&&<Pin className="w-3 h-3 text-app-accent"/>}</div><p className="text-xs text-app-muted truncate mt-0.5">{note.body||'내용을 작성해 보세요.'}</p><p className="text-[10px] text-app-muted mt-1 truncate">{folders.find(folder=>folder.id===note.folderId)?.name||'미분류'} · {new Date(note.updatedAt).toLocaleDateString('ko-KR')}</p></button>)}
   </div>
  </section>
  <div className={'notes-editor min-w-0 '+(!mobileEditor?'hidden md:flex':'flex')}>
   {current?<NoteEditor key={current.id} note={current} schedules={schedules} onOpenTask={onOpenTask} onOpenSchedule={onOpenSchedule} categories={categories} folders={folders} tasks={tasks} onSave={onSave} onTask={onTask} onSchedule={onSchedule} focus={focus} onFocus={()=>setFocus(!focus)} onBack={()=>{setMobileEditor(false);setFocus(false);}}/>:<div className="flex-1 flex flex-col items-center justify-center text-app-muted p-8 text-center"><FileText className="w-10 h-10 text-app-outline mb-4"/><h2 className="font-semibold text-app-ink">생각을 적는 나만의 공간</h2><p className="text-sm mt-2 leading-6">메모를 선택하거나 새로 작성하세요.<br/>작성한 내용은 할 일과 일정으로 연결할 수 있어요.</p></div>}
  </div>
  {error&&<p role="alert" className="col-span-full px-4 py-2 text-xs text-red-600">{error}</p>}
 </section>;
}

function NoteEditor({note,schedules,onOpenTask,onOpenSchedule,categories,folders,tasks,onSave,onTask,onSchedule,focus,onFocus,onBack}:Pick<Props,'schedules'|'onOpenTask'|'onOpenSchedule'|'categories'|'folders'|'tasks'|'onSave'|'onTask'|'onSchedule'>&{note:Note;focus:boolean;onFocus:()=>void;onBack:()=>void}){
 const [draft,setDraft]=useState(note),[status,setStatus]=useState('저장됨'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[date,setDate]=useState(getTodayDateString);
 const [categoryOverride,setCategoryOverride]=useState<string|null>(null);
 const preferredCategory=categoryOverride??folders.find(folder=>folder.id===draft.folderId)?.defaultCategoryId??'';
 const categoryId=categories.some(category=>category.id===preferredCategory)?preferredCategory:'';
 const revision=useRef(0),pending=useRef(Promise.resolve()),dirty=useRef(false);
 const recommendations=recommendNoteFolders(draft.title+' '+draft.body,folders).filter(folder=>folder.id!==draft.folderId);
 useEffect(()=>{if(!dirty.current)setDraft(note);},[note]);
 useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[]);
 async function update(patch:Partial<Note>){
  if(patch.folderId!==undefined)setCategoryOverride(null);
  const next={...draft,...patch,updatedAt:Date.now()};setDraft(next);dirty.current=true;const version=++revision.current;setStatus('저장 중…');setError('');
  const save=pending.current.catch(()=>{}).then(()=>onSave(next));pending.current=save;
  try{await save;if(version===revision.current){dirty.current=false;setStatus('저장됨');}}catch(e){if(version===revision.current){setStatus('저장 실패');setError(e instanceof Error?e.message:'저장하지 못했습니다. 다시 시도해 주세요.');}}
 }
 async function link(kind:'task'|'schedule'){if(busy)return;setBusy(true);setError('');setNotice('');try{await pending.current; if(dirty.current)throw new Error('메모를 먼저 다시 저장해 주세요.');if(kind==='task'){await onTask(draft,date,categoryId);setNotice('기존 할 일 목록에 등록했습니다.');}else await onSchedule(draft,categoryId,date);}catch(e){setError(e instanceof Error?e.message:'등록하지 못했습니다.');}finally{setBusy(false);}}
 const linkedTasks=tasks.filter(task=>task.sourceNoteId===draft.id),linkedSchedules=schedules.filter(schedule=>schedule.sourceNoteId===draft.id);
 const linked=tasks.some(task=>task.sourceNoteId===draft.id&&task.dueDate===date);
 return <article data-note-editor aria-label="메모 편집기" className="flex-1 min-w-0 flex flex-col" onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void update({});}}}>
  <header className="note-editor-header flex items-center gap-0.5 px-2 py-0.5 border-b border-app-line flex-wrap">
   <button type="button" className={button+' !min-h-7 !px-1.5 md:hidden'} aria-label="메모 목록으로" onClick={onBack}><ArrowLeft className="w-4 h-4"/></button><span role="status" aria-label="메모 저장 상태" className="text-[11px] text-app-muted">{status}</span><label className="sr-only" htmlFor="note-folder">메모 분류</label><select id="note-folder" disabled={!!draft.deletedAt} value={draft.folderId} className="min-h-7 rounded-md border border-app-line max-w-full px-2 bg-app-canvas" onChange={e=>void update({folderId:e.target.value})}><option value="">미분류</option>{folders.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><span className="flex-1"/>
   <button type="button" aria-label={draft.pinned?'메모 고정 해제':'메모 고정'} aria-pressed={draft.pinned} className={button+' !min-h-7 !px-1.5'} onClick={()=>void update({pinned:!draft.pinned})}><Pin className={'w-4 h-4 '+(draft.pinned?'fill-app-peach text-app-accent':'')}/></button>
   <button type="button" aria-label={focus?'집중 모드 종료':'집중 모드'} className={button+' !min-h-7 !px-1.5 hidden md:inline-flex'} onClick={onFocus}>{focus?<Minimize2 className="w-4 h-4"/>:<Maximize2 className="w-4 h-4"/>}</button>
   <button type="button" aria-label={draft.deletedAt?'메모 복원':'메모 휴지통으로'} className={button+' !min-h-7 !px-1.5'} onClick={()=>void update({deletedAt:draft.deletedAt?undefined:Date.now()})}>{draft.deletedAt?<RotateCcw className="w-4 h-4"/>:<Trash2 className="w-4 h-4"/>}</button>
  </header>
  {recommendations.length>0&&!draft.deletedAt&&<div className="px-3 pt-1 flex flex-wrap items-center gap-1 text-xs">

   {recommendations.length>0&&!draft.deletedAt&&<span className="text-app-muted">추천:</span>}{!draft.deletedAt&&recommendations.map(folder=><button key={folder.id} type="button" className="min-h-7 px-2 text-app-accent-hover rounded-md hover:bg-app-soft" onClick={()=>void update({folderId:folder.id})}>#{folder.name}</button>)}
  </div>}
  <input aria-label="메모 제목" placeholder="제목 없는 메모" maxLength={500} readOnly={!!draft.deletedAt} value={draft.title} onChange={e=>void update({title:e.target.value})} className="min-w-0 w-full px-3 pt-1.5 pb-2 text-xl font-bold outline-none bg-transparent"/>
  <RichNoteBody body={draft.body} runs={draft.richBody} blocks={draft.richDocument} readOnly={!!draft.deletedAt} onChange={(body,richBody,richDocument)=>void update({body,richBody,richDocument})}/>
  <div className="px-4 sm:px-6 py-2 flex gap-2 items-center"><label htmlFor="note-tags" className="text-xs text-app-muted shrink-0">태그</label><input id="note-tags" aria-label="메모 태그" placeholder="쉼표로 구분" readOnly={!!draft.deletedAt} value={draft.tags.join(', ')} onChange={e=>void update({tags:e.target.value.split(',').map(tag=>tag.trimStart())})} className="min-w-0 flex-1 py-1 text-xs outline-none"/></div>
  {!draft.deletedAt&&<footer className="border-t border-app-line px-3 py-2 flex flex-wrap gap-1.5 items-center bg-app-canvas">
   <label className="sr-only" htmlFor="note-task-date">등록 날짜</label><input id="note-task-date" aria-label="등록 날짜" type="date" value={date} onChange={e=>setDate(e.target.value)} className="min-h-8 px-2 max-w-full text-xs border border-app-line rounded-lg bg-white"/>
   <select aria-label="등록 카테고리" value={categoryId} onChange={e=>setCategoryOverride(e.target.value)} className="min-h-8 px-2 max-w-full text-xs border border-app-line rounded-lg bg-white"><option value="">카테고리 선택</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select>
   <button type="button" className={button+' bg-app-soft text-app-accent-hover'} disabled={busy||linked||!date||(!draft.title.trim()&&!draft.body.trim())} onClick={()=>void link('task')}><CheckSquare className="w-3.5 h-3.5"/>{linked?'할 일 등록됨':'할 일로 등록'}</button>
   <button type="button" className={button+' text-app-accent-hover'} disabled={busy||(!draft.title.trim()&&!draft.body.trim())} onClick={()=>void link('schedule')}><CalendarPlus className="w-3.5 h-3.5"/>일정으로 등록</button>
  </footer>}
  {(linkedTasks.length>0||linkedSchedules.length>0)&&<details className="border-t border-app-line px-3 py-1 text-xs"><summary className="min-h-8 py-1.5 cursor-pointer text-app-muted">연결된 항목 · 할 일 {linkedTasks.length} · 일정 {linkedSchedules.length}</summary><ul className="max-h-32 overflow-y-auto space-y-1 pb-2">{linkedTasks.map(task=><li key={task.id}><button type="button" onClick={()=>onOpenTask(task.id)} className="w-full text-left min-h-8 text-app-ink hover:text-app-accent"><CheckSquare aria-hidden="true" className="inline w-3.5 h-3.5 mr-1"/>{task.title} · {task.dueDate||'날짜 미정'}{task.status==='done'?' · 완료':''}</button></li>)}{linkedSchedules.map(schedule=><li key={schedule.id}><button type="button" onClick={()=>onOpenSchedule(schedule.id)} className="w-full text-left min-h-8 text-app-ink hover:text-app-accent"><CalendarPlus aria-hidden="true" className="inline w-3.5 h-3.5 mr-1"/>{schedule.title} · {schedule.date}</button></li>)}</ul></details>}
  {notice&&<p role="status" className="px-4 py-2 text-xs text-app-accent-hover">{notice}</p>}
  {error&&<p role="alert" className="px-4 py-2 text-xs text-red-600">{error}<button type="button" onClick={()=>void update({})} className={button}>다시 저장</button></p>}
 </article>;
}
