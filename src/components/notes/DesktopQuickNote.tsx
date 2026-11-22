import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,Plus} from 'lucide-react';
import {getAllNotes,getNoteFolders,initializeDatabase,saveNote} from '../../db/indexedDB';
import type {Note,NoteFolder} from '../../types';
import {syncEngine} from '../../sync/syncEngine';
import {isDemo} from '../../sync/demoMode';
import {LoginScreen} from '../layout/LoginScreen';
import {recommendNoteFolders} from '../../utils/notes';
const blank=():Note=>{const now=Date.now();return{id:crypto.randomUUID(),title:'',body:'',folderId:'',tags:[],pinned:false,createdAt:now,updatedAt:now};};
export function DesktopQuickNote(){
 const [draft,setDraft]=useState(blank),[folders,setFolders]=useState<NoteFolder[]>([]),[notes,setNotes]=useState<Note[]>([]),[ready,setReady]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[connected,setConnected]=useState(syncEngine.connected||isDemo()),[sync,setSync]=useState(syncEngine.getStatus());
 const current=useRef(draft),pending=useRef(Promise.resolve()),saved=useRef<number|undefined>(undefined),revision=useRef(0),dirty=useRef(false),input=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{
  const reload=async()=>{const [f,n]=await Promise.all([getNoteFolders(),getAllNotes()]);setFolders(f);setNotes(n);setConnected(syncEngine.connected||isDemo());};
  void initializeDatabase().then(reload).then(()=>setReady(true)).catch(()=>setError('메모를 불러오지 못했습니다. 다시 열어 주세요.'));
  syncEngine.setRemoteChangeHandler(reload);syncEngine.start();const unsubscribe=syncEngine.subscribe(setSync),refresh=window.miniallyDesktop!.onRefresh(()=>{void reload().catch(()=>setError('분류를 불러오지 못했습니다.'));}),focus=window.miniallyDesktop!.onQuickFocus(()=>input.current?.focus());
  const flush=(event:Event)=>{(event as CustomEvent<{waits:Promise<unknown>[]}>) .detail.waits.push(pending.current.then(()=>{if(dirty.current)throw new Error('메모 저장을 확인해 주세요.');}));};
  window.addEventListener('minially:flush',flush);return()=>{unsubscribe();refresh();focus();window.removeEventListener('minially:flush',flush);};
 },[]);
 async function update(patch:Partial<Note>){
  const next={...current.current,...patch,updatedAt:Math.max(Date.now(),current.current.updatedAt+1)};current.current=next;setDraft(next);dirty.current=true;setError('');setStatus('저장 중…');const version=++revision.current;
  const task=pending.current.catch(()=>{}).then(async()=>{await saveNote(next,saved.current);saved.current=next.updatedAt;window.miniallyDesktop!.notifySaved();syncEngine.schedule();});pending.current=task;
  try{await task;if(revision.current===version){dirty.current=false;setStatus('저장됨');}}catch(e){if(revision.current===version){setStatus('저장 실패');setError(e instanceof Error?e.message:'저장하지 못했습니다.');}}
 }
 async function action(kind:'new'|'open'|'close'){
  if(busy)return;setBusy(true);setError('');try{await pending.current;if(dirty.current)throw new Error('저장하지 못한 메모가 있습니다. 다시 저장해 주세요.');if(kind==='new'){const next=blank();current.current=next;setDraft(next);saved.current=undefined;setStatus('');input.current?.focus();}else if(kind==='open'){if(saved.current)await window.miniallyDesktop!.openNote(current.current.id);else await window.miniallyDesktop!.showMain();await window.miniallyDesktop!.hideQuick();}else await window.miniallyDesktop!.hideQuick();}catch(e){setError(e instanceof Error?e.message:'작업을 마치지 못했습니다.');}finally{setBusy(false);}
 }
 if(!connected)return <LoginScreen/>;
 const recommendations=recommendNoteFolders(draft.body,folders,notes.filter(note=>note.id!==draft.id)).filter(folder=>folder.id!==draft.folderId);
 return <main className="h-dvh flex flex-col bg-app-canvas text-app-ink p-3 gap-2" onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();void action('close');}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void update({});}}}>
  <header className="flex items-center justify-between text-xs"><h1 className="font-bold">빠른 메모</h1><button className="min-h-8 px-2 flex items-center gap-1 text-app-accent-hover" onClick={()=>void action('open')} disabled={busy}>미니어리 열기<ArrowUpRight size={14}/></button></header>
  <textarea ref={input} autoFocus disabled={!ready||busy} aria-label="빠른 메모 본문" placeholder="메모를 입력하세요" value={draft.body} onChange={event=>void update({body:event.target.value})} onCompositionStart={event=>event.currentTarget.dataset.noteComposing='true'} onCompositionEnd={event=>event.currentTarget.dataset.noteComposing='false'} className="flex-1 min-h-24 resize-none bg-white border border-app-line rounded-xl p-3 text-sm leading-6 outline-none focus:border-app-accent"/>
  <div className="flex flex-wrap gap-1 items-center text-xs"><select aria-label="빠른 메모 분류" value={draft.folderId} disabled={busy||!ready} onChange={event=>void update({folderId:event.target.value})} className="max-w-full min-h-8 px-2 rounded-lg border border-app-line bg-white"><option value="">미분류</option>{folders.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>{recommendations.map(folder=><button key={folder.id} className="min-h-8 px-2 rounded-lg text-app-accent-hover bg-app-soft" onClick={()=>void update({folderId:folder.id})}>추천: {folder.name}</button>)}</div>
  <div role="status" className="text-[11px] text-app-muted">{status}{status?' · ':''}{isDemo()?'체험 모드':sync.kind==='offline'?'오프라인 · 기기에 저장':sync.kind==='error'?'기기에 저장 · 동기화 재시도 필요':sync.kind==='syncing'?'동기화 중…':'같은 연결 코드로 동기화'}</div>
  {error&&<div role="alert" className="text-xs text-red-600">{error}<button className="ml-2 underline min-h-8" onClick={()=>void update({})}>다시 저장</button></div>}
  <footer className="flex justify-between gap-2"><button disabled={busy||!ready} className="min-h-9 px-3 rounded-lg border border-app-line flex items-center gap-1 text-xs" onClick={()=>void action('new')}><Plus size={14}/>새 메모</button><button disabled={busy||!ready} className="min-h-9 px-3 rounded-lg bg-app-accent text-white flex items-center gap-1 text-xs" onClick={()=>void action('close')}><Check size={14}/>완료</button></footer>
 </main>;
}
