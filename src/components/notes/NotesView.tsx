import {NoteFolderModal} from './NoteFolderModal';
import {RichNoteBody} from './RichNoteBody';
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeft, CheckSquare, CalendarPlus, FileText, Folder, Plus, Search, Pin, Trash2, Maximize2, Minimize2, RotateCcw, X} from 'lucide-react';
import type {Note, NoteFolder, Task, CategoryItem, Schedule} from '../../types';
import {noteTitle, recommendNoteFolders} from '../../utils/notes';
import {getTodayDateString} from '../../utils/dateHelpers';

interface Props {
 active?:boolean; schedules:Schedule[]; onOpenTask:(id:string)=>void; onOpenSchedule:(id:string)=>void;
 categories:CategoryItem[]; notes:Note[]; folders:NoteFolder[]; tasks:Task[]; openNoteId?:string;
 onSave:(note:Note)=>Promise<void>; onSaveFolder:(folder:NoteFolder)=>Promise<void>;
 onTask:(note:Note,date:string,categoryId:string,excerpt?:string)=>Promise<void>; onSchedule:(note:Note,categoryId:string,date:string,excerpt?:string)=>Promise<void>;
}
const button='inline-flex items-center justify-center gap-1.5 min-h-9 px-2.5 rounded-lg text-xs hover:bg-app-soft transition-colors disabled:opacity-50 cursor-pointer';
const field='w-full min-w-0 px-3 py-2 text-sm rounded-lg border border-app-line bg-white outline-none focus:border-app-accent';
export function NotesView({active=true,schedules,onOpenTask,onOpenSchedule,categories,notes,folders,tasks,onSave,onSaveFolder,onTask,onSchedule,openNoteId}:Props){
 const [filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[selected,setSelected]=useState<string|null>(null),[focus,setFocus]=useState(false),[mobileEditor,setMobileEditor]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [folderDialog,setFolderDialog]=useState<{open:boolean;folder?:NoteFolder}>({open:false});
 useEffect(()=>{if(active&&openNoteId){setSelected(openNoteId);setMobileEditor(true);}},[openNoteId,active]);
 const pageScroll=useRef(0);
 useLayoutEffect(()=>{if(!active)return;const savedScroll=pageScroll.current;const frame=requestAnimationFrame(()=>window.scrollTo(0,savedScroll));const remember=()=>{pageScroll.current=window.scrollY;};window.addEventListener('scroll',remember,{passive:true});return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',remember);};},[active]);
 useEffect(()=>{if(!active)setFolderDialog(previous=>({...previous,open:false}));},[active]);
 const searchRef=useRef<HTMLInputElement>(null);
 function openNoteSearch(){setMobileEditor(false);setFocus(false);requestAnimationFrame(()=>searchRef.current?.focus());}
 const visible=useMemo(()=>notes.filter(note=>filter==='trash'?!!note.deletedAt:!note.deletedAt&&(filter==='all'||(filter==='pinned'?note.pinned:note.folderId===filter))).filter(note=>(note.title+' '+note.body+' '+note.tags.join(' ')).toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updatedAt-a.updatedAt),[notes,filter,query]);
 const current=notes.find(note=>note.id===selected);
 async function create(){if(busy)return;setBusy(true);setError('');const now=Date.now();const note:Note={id:crypto.randomUUID(),title:'',body:'',folderId:'',tags:[],pinned:false,createdAt:now,updatedAt:now};try{await onSave(note);setSelected(note.id);setMobileEditor(true);setFilter('all');setQuery('');}catch(e){setError(e instanceof Error?e.message:'메모를 저장하지 못했습니다.');}finally{setBusy(false);}}
 return <section aria-label="메모장" className={'notes-workspace rounded-2xl border border-app-line bg-white overflow-hidden '+(focus?'notes-focus':'')}>
  <aside aria-label="메모 분류" className={'notes-folders bg-app-canvas border-r border-app-line p-3 '+(mobileEditor?'hidden md:block':'')}>
   <h1 className="text-base font-bold px-2 py-2 flex items-center gap-2"><FileText className="w-4 h-4 text-app-accent"/>메모</h1>
   <div className="flex md:flex-col gap-1 flex-wrap">
    {[['all','모든 메모'],['pinned','고정 메모'],...folders.map(folder=>[folder.id,folder.name]),['trash','휴지통']].map(([id,label])=><button key={id} type="button" title={label} aria-pressed={filter===id} onClick={()=>{setFilter(id);setSelected(null);}} className={button+' justify-start text-left min-w-0 max-w-full md:w-full '+(filter===id?'bg-app-soft text-app-accent-hover font-semibold':'text-app-muted')}><Folder className="w-3.5 h-3.5 shrink-0"/><span className="truncate flex-1">{label}</span><span className="ml-auto text-[10px] shrink-0">{notes.filter(note=>id==='trash'?!!note.deletedAt:!note.deletedAt&&(id==='all'||(id==='pinned'?note.pinned:note.folderId===id))).length}</span></button>)}
   </div>
   <button type="button" className={button+' mt-3 text-app-accent-hover'} onClick={()=>setFolderDialog({open:true})}><Plus className="w-3.5 h-3.5"/>분류 추가</button>
   {folders.some(folder=>folder.id===filter)&&<button type="button" className={button+' text-app-muted'} onClick={()=>setFolderDialog({open:true,folder:folders.find(item=>item.id===filter)})}>폴더 설정</button>}
   <p className="hidden md:block mt-5 px-2 text-[11px] leading-5 text-app-muted">편하게 적고 정리하세요.<br/>내용에 맞는 분류를 추천해요.</p>
  </aside>
  <section aria-label="메모 목록" className={'notes-list border-r border-app-line min-w-0 flex flex-col '+(mobileEditor?'hidden md:flex':'')}>
   <div className="p-2 space-y-1.5 border-b border-app-line">
    <form role="search" aria-label="메모 검색" onSubmit={event=>event.preventDefault()} className="flex items-center gap-2"><button type="button" aria-label="메모 검색 열기" data-shortcut="notes-search" className="shrink-0 p-1 text-app-muted" onClick={openNoteSearch}><Search className="w-4 h-4"/></button><input ref={searchRef} type="search" className="w-full min-w-0 text-sm py-1.5 outline-none" aria-label="메모 검색" placeholder="메모 검색" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" aria-label="메모 검색 지우기" className="shrink-0 p-1 text-app-muted" onClick={()=>{setQuery('');searchRef.current?.focus();}}><X className="w-4 h-4"/></button>}</form>
    <div className="flex justify-end"><button type="button" data-shortcut="notes-new" disabled={busy} onClick={()=>void create()} className={button+' bg-app-accent text-white hover:bg-app-accent-hover'}><Plus className="w-3.5 h-3.5"/>새 메모</button></div>
   </div>
   <div className="overflow-y-auto flex-1 min-h-32 p-2 space-y-1">
    {!visible.length&&<p className="text-xs text-app-muted px-3 py-5">{filter==='trash'?'휴지통이 비어 있습니다.':query?'검색 결과가 없습니다.':'첫 메모를 편하게 남겨 보세요.'}</p>}
    {visible.map(note=><button key={note.id} type="button" data-note-id={note.id} aria-pressed={selected===note.id} onClick={()=>{setSelected(note.id);setMobileEditor(true);}} className={'w-full text-left rounded-lg px-2.5 py-2 border transition-colors '+(selected===note.id?'border-app-outline bg-app-soft':'border-transparent hover:bg-app-canvas')}><div className="flex gap-1 items-center"><span className="text-sm font-semibold truncate min-w-0 flex-1">{noteTitle(note)}</span>{note.pinned&&<Pin className="w-3 h-3 text-app-accent"/>}</div><p className="text-xs text-app-muted truncate mt-0.5">{note.body||'내용을 작성해 보세요.'}</p><p className="text-[10px] text-app-muted mt-1 truncate">{folders.find(folder=>folder.id===note.folderId)?.name||'미분류'} · {new Date(note.updatedAt).toLocaleDateString('ko-KR')}</p></button>)}
   </div>
  </section>
  <div className={'notes-editor min-w-0 '+(!mobileEditor?'hidden md:flex':'flex')}>
   {current?<NoteEditor key={current.id} note={current} schedules={schedules} onOpenTask={onOpenTask} onOpenSchedule={onOpenSchedule} categories={categories} folders={folders} tasks={tasks} onSave={onSave} onTask={onTask} onSchedule={onSchedule} onCreate={create} focus={focus} onFocus={()=>setFocus(!focus)} onBack={()=>{setMobileEditor(false);setFocus(false);}}/>:<div className="flex-1 flex flex-col items-center justify-center text-app-muted p-8 text-center"><FileText className="w-10 h-10 text-app-outline mb-4"/><h2 className="font-semibold text-app-ink">생각을 적는 나만의 공간</h2><p className="text-sm mt-2 leading-6">메모를 선택하거나 새로 작성하세요.<br/>작성한 내용은 할 일과 일정으로 연결할 수 있어요.</p></div>}
  </div>
  <NoteFolderModal open={folderDialog.open} folder={folderDialog.folder} categories={categories} onSave={onSaveFolder} onClose={()=>setFolderDialog(previous=>({...previous,open:false}))}/>
  {error&&<p role="alert" className="col-span-full px-4 py-2 text-xs text-red-600">{error}</p>}
 </section>;
}

function NoteEditor({note,schedules,onOpenTask,onOpenSchedule,categories,folders,tasks,onSave,onTask,onSchedule,onCreate,focus,onFocus,onBack}:Pick<Props,'schedules'|'onOpenTask'|'onOpenSchedule'|'categories'|'folders'|'tasks'|'onSave'|'onTask'|'onSchedule'>&{note:Note;onCreate:()=>Promise<void>;focus:boolean;onFocus:()=>void;onBack:()=>void}){
 const [draft,setDraft]=useState(note),[status,setStatus]=useState('저장됨'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[date,setDate]=useState(getTodayDateString);
 const [categoryOverride,setCategoryOverride]=useState<string|null>(null);
 const editorRoot=useRef<HTMLElement>(null);
 const [selectionText,setSelectionText]=useState(''),[linkExcerpt,setLinkExcerpt]=useState<string|undefined>(),[linkTitle,setLinkTitle]=useState<string|undefined>();
 useEffect(()=>{const remember=()=>{const body=editorRoot.current?.querySelector('[contenteditable]'),selection=window.getSelection();if(body&&selection&&body.contains(selection.anchorNode)&&body.contains(selection.focusNode))setSelectionText(selection.toString().trim());};document.addEventListener('selectionchange',remember);return()=>document.removeEventListener('selectionchange',remember);},[]);
 const registrationTitle=linkTitle??(linkExcerpt?.split('\n')[0].slice(0,80)||noteTitle(draft));
 const registrationNote={...draft,title:registrationTitle,body:linkExcerpt??draft.body,richBody:undefined,richDocument:undefined};
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
 async function link(kind:'task'|'schedule'){if(busy)return;setBusy(true);setError('');setNotice('');try{await pending.current; if(dirty.current)throw new Error('메모를 먼저 다시 저장해 주세요.');if(linkExcerpt!==undefined&&new TextEncoder().encode(JSON.stringify([linkExcerpt,linkExcerpt])).length>220*1024)throw new Error('선택한 내용이 너무 깁니다. 나눠서 연결해 주세요.');if(kind==='task'){await onTask(registrationNote,date,categoryId,linkExcerpt);setNotice('기존 할 일 목록에 등록했습니다.');}else await onSchedule(registrationNote,categoryId,date,linkExcerpt);}catch(e){setError(e instanceof Error?e.message:'등록하지 못했습니다.');}finally{setBusy(false);}}
 const linkedTasks=tasks.filter(task=>task.sourceNoteId===draft.id),linkedSchedules=schedules.filter(schedule=>schedule.sourceNoteId===draft.id);
 const registeredTask=tasks.find(task=>task.sourceNoteId===draft.id&&task.dueDate===date&&(task.sourceNoteExcerpt??'')===(linkExcerpt??''));
 const linked=!!registeredTask;
 async function navigate(action:()=>void|Promise<void>){setError('');try{await pending.current;if(dirty.current)throw new Error('메모를 먼저 다시 저장해 주세요.');await action();}catch(e){setError(e instanceof Error?e.message:'이동하지 못했습니다. 다시 시도해 주세요.');}}
 return <article ref={editorRoot} data-note-editor aria-label="메모 편집기" className="flex-1 min-w-0 flex flex-col" onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void update({});}}}>
  <header className="note-editor-header flex items-center gap-0.5 px-2 py-0.5 border-b border-app-line flex-wrap">
   <button type="button" className={button+' !min-h-7 !px-1.5 md:hidden'} aria-label="메모 목록으로" onClick={()=>void navigate(onBack)}><ArrowLeft className="w-4 h-4"/></button><span role="status" aria-label="메모 저장 상태" className="text-[11px] text-app-muted">{status}</span><label className="sr-only" htmlFor="note-folder">메모 분류</label><select id="note-folder" disabled={!!draft.deletedAt} value={draft.folderId} className="min-h-7 rounded-md border border-app-line max-w-full px-2 bg-app-canvas" onChange={e=>void update({folderId:e.target.value})}><option value="">미분류</option>{folders.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><span className="flex-1"/>
   <button type="button" aria-label="새 메모 작성" title="새 메모 작성" className={button+' !min-h-7 !px-1.5'} onClick={()=>void navigate(onCreate)}><Plus className="w-4 h-4"/></button>
   <button type="button" aria-label={draft.pinned?'메모 고정 해제':'메모 고정'} aria-pressed={draft.pinned} className={button+' !min-h-7 !px-1.5'} onClick={()=>void update({pinned:!draft.pinned})}><Pin className={'w-4 h-4 '+(draft.pinned?'fill-app-peach text-app-accent':'')}/></button>
   <button type="button" aria-label={focus?'집중 모드 종료':'집중 모드'} className={button+' !min-h-7 !px-1.5 hidden md:inline-flex note-focus-toggle'} onClick={onFocus}>{focus?<Minimize2 className="w-4 h-4"/>:<Maximize2 className="w-4 h-4"/>}</button>
   <button type="button" aria-label={draft.deletedAt?'메모 복원':'메모 휴지통으로'} className={button+' !min-h-7 !px-1.5'} onClick={()=>void update({deletedAt:draft.deletedAt?undefined:Date.now()})}>{draft.deletedAt?<RotateCcw className="w-4 h-4"/>:<Trash2 className="w-4 h-4"/>}</button>
  </header>
  {recommendations.length>0&&!draft.deletedAt&&<div className="px-3 pt-1 flex flex-wrap items-center gap-1 text-xs">

   {recommendations.length>0&&!draft.deletedAt&&<span className="text-app-muted">추천:</span>}{!draft.deletedAt&&recommendations.map(folder=><button key={folder.id} type="button" className="min-h-7 px-2 text-app-accent-hover rounded-md hover:bg-app-soft" onClick={()=>void update({folderId:folder.id})}>#{folder.name}</button>)}
  </div>}
  <input autoFocus={!note.title&&!note.body&&!note.deletedAt} aria-label="메모 제목" placeholder="제목 없는 메모" maxLength={500} readOnly={!!draft.deletedAt} value={draft.title} onChange={e=>void update({title:e.target.value})} className="min-w-0 w-full px-3 pt-1.5 pb-2 text-xl font-bold outline-none bg-transparent"/>
  <RichNoteBody body={draft.body} runs={draft.richBody} blocks={draft.richDocument} readOnly={!!draft.deletedAt} onChange={(body,richBody,richDocument)=>void update({body,richBody,richDocument})}/>
  <div className="px-4 sm:px-6 py-2 flex gap-2 items-center"><label htmlFor="note-tags" className="text-xs text-app-muted shrink-0">태그</label><input id="note-tags" aria-label="메모 태그" placeholder="쉼표로 구분" readOnly={!!draft.deletedAt} value={draft.tags.join(', ')} onChange={e=>void update({tags:e.target.value.split(',').map(tag=>tag.trimStart())})} className="min-w-0 flex-1 py-1 text-xs outline-none"/></div>
  {!draft.deletedAt&&<footer aria-label="할 일·일정 연결" className="border-t border-app-line px-3 py-2 flex flex-wrap gap-1.5 items-center bg-app-canvas">
   <div className="w-full flex items-center justify-between text-[11px] text-app-muted"><span>할 일·일정으로 연결</span>{date!==getTodayDateString()&&<button type="button" className="min-h-7 px-2 text-app-accent-hover" onClick={()=>setDate(getTodayDateString())}>오늘</button>}</div>
   {(selectionText||linkExcerpt!==undefined)&&<div className="w-full flex flex-wrap gap-1 text-xs">{selectionText&&<button type="button" className={button+' bg-app-soft text-app-accent-hover'} onPointerDown={event=>event.preventDefault()} onClick={()=>{setLinkExcerpt(selectionText);setLinkTitle(undefined);}}>선택한 내용 사용</button>}{linkExcerpt!==undefined&&<button type="button" className={button+' text-app-muted'} onClick={()=>{setLinkExcerpt(undefined);setLinkTitle(undefined);}}>메모 전체 사용</button>}</div>}
   {linkExcerpt!==undefined&&<blockquote aria-label="연결할 선택 내용" className="w-full max-h-20 overflow-auto rounded-lg border-l-2 border-app-accent px-2 py-1 text-xs text-app-muted whitespace-pre-wrap break-words">{linkExcerpt}</blockquote>}
   <label className="w-full text-[11px] text-app-muted">등록할 제목<input aria-label="등록할 제목" maxLength={500} value={registrationTitle} onChange={event=>setLinkTitle(event.target.value)} className="w-full min-w-0 mt-1 min-h-8 px-2 text-sm border border-app-line rounded-lg bg-white text-app-ink"/></label>
   <label className="sr-only" htmlFor="note-task-date">등록 날짜</label><input id="note-task-date" aria-label="등록 날짜" type="date" value={date} onChange={e=>setDate(e.target.value)} className="min-h-8 px-2 max-w-full text-xs border border-app-line rounded-lg bg-white"/>
   <select aria-label="등록 카테고리" value={categoryId} onChange={e=>setCategoryOverride(e.target.value)} className="min-h-8 px-2 max-w-full text-xs border border-app-line rounded-lg bg-white"><option value="">카테고리 선택</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select>
   <button type="button" className={button+' bg-app-soft text-app-accent-hover'} disabled={busy||linked||!date||!registrationTitle.trim()||(!draft.title.trim()&&!draft.body.trim())} onClick={()=>void link('task')}><CheckSquare className="w-3.5 h-3.5"/>{linked?'할 일 등록됨':'할 일로 등록'}</button>
   <button type="button" className={button+' text-app-accent-hover'} disabled={busy||!date||!registrationTitle.trim()||(!draft.title.trim()&&!draft.body.trim())} onClick={()=>void link('schedule')}><CalendarPlus className="w-3.5 h-3.5"/>일정으로 등록</button>
   {registeredTask&&<button type="button" className={button+' text-app-accent-hover'} onClick={()=>void navigate(()=>onOpenTask(registeredTask.id))}>등록한 할 일 보기</button>}
  </footer>}
  {(linkedTasks.length>0||linkedSchedules.length>0)&&<details className="border-t border-app-line px-3 py-1 text-xs"><summary className="min-h-8 py-1.5 cursor-pointer text-app-muted">연결된 항목 · 할 일 {linkedTasks.length} · 일정 {linkedSchedules.length}</summary><ul className="max-h-32 overflow-y-auto space-y-1 pb-2">{linkedTasks.map(task=><li key={task.id}><button type="button" onClick={()=>void navigate(()=>onOpenTask(task.id))} className="w-full text-left min-h-8 text-app-ink hover:text-app-accent"><CheckSquare aria-hidden="true" className="inline w-3.5 h-3.5 mr-1"/>{task.title} · {task.dueDate||'날짜 미정'}{task.status==='done'?' · 완료':''}</button></li>)}{linkedSchedules.map(schedule=><li key={schedule.id}><button type="button" onClick={()=>void navigate(()=>onOpenSchedule(schedule.id))} className="w-full text-left min-h-8 text-app-ink hover:text-app-accent"><CalendarPlus aria-hidden="true" className="inline w-3.5 h-3.5 mr-1"/>{schedule.title} · {schedule.date}</button></li>)}</ul></details>}
  {notice&&<p role="status" className="px-4 py-2 text-xs text-app-accent-hover">{notice}</p>}
  {error&&<p role="alert" className="px-4 py-2 text-xs text-red-600">{error}<button type="button" onClick={()=>void update({})} className={button}>다시 저장</button></p>}
 </article>;
}
