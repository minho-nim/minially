import {useEffect,useRef,useState} from 'react';
import type {NoteDefaults} from '../../types';
import {NOTE_FONTS,NOTE_SIZES,NOTE_LINE_HEIGHTS} from '../../utils/noteRichDocument';
import {DEFAULT_NOTE_STYLE,resolveNoteDefaults} from '../../utils/noteFormatting';
import {NoteColorPicker} from './NoteColorPicker';
interface Props {value?:NoteDefaults;onSave:(value:NoteDefaults)=>Promise<void>;onDirtyChange?:(dirty:boolean)=>void;onBusyChange?:(busy:boolean)=>void}
const field='w-full min-w-0 mt-1 min-h-9 px-2 rounded-lg border border-app-line bg-app-canvas text-sm';
export function NoteDefaultsForm({value,onSave,onDirtyChange,onBusyChange}:Props){
 const [draft,setDraft]=useState(()=>resolveNoteDefaults(value)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const valueKey=JSON.stringify(resolveNoteDefaults(value)),previous=useRef(valueKey);
 useEffect(()=>{const before=previous.current;previous.current=valueKey;setDraft(current=>JSON.stringify(current)===before?resolveNoteDefaults(value):current);},[valueKey]);const dirty=JSON.stringify(draft)!==JSON.stringify(resolveNoteDefaults(value));
 useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
 async function save(){if(busy)return;setBusy(true);setError('');setNotice('');try{await onSave(draft);setNotice('새 메모의 기본 서식을 저장했습니다.');}catch(e){setError(e instanceof Error?e.message:'설정을 저장하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false);}}
 return <form data-unsaved-note-defaults={dirty} data-note-defaults-busy={busy} aria-label="메모 기본 서식" onSubmit={event=>{event.preventDefault();void save();}} className="space-y-3 text-app-ink">
  <p className="text-xs leading-5 text-app-muted">새 메모의 기본 서식이에요. 이미 작성한 메모의 서식은 유지돼요. 글꼴이 기기에 없으면 기본 글꼴로 표시돼요.</p>
  <fieldset disabled={busy} className="grid grid-cols-2 gap-3 min-w-0"><label className="col-span-2 text-xs">기본 글꼴<select aria-label="기본 글꼴" className={field} value={draft.fontFamily} onChange={event=>setDraft({...draft,fontFamily:event.target.value})}>{NOTE_FONTS.map(font=><option key={font}>{font}</option>)}</select></label><label className="text-xs">기본 글자 크기<select aria-label="기본 글자 크기" className={field} value={draft.fontSize} onChange={event=>setDraft({...draft,fontSize:Number(event.target.value)})}>{[...new Set([...NOTE_SIZES,10.5,draft.fontSize])].sort((a,b)=>a-b).map(size=><option key={size} value={size}>{size}pt</option>)}</select></label><label className="text-xs">기본 줄간격<select aria-label="기본 줄간격" className={field} value={draft.lineHeight} onChange={event=>setDraft({...draft,lineHeight:Number(event.target.value)})}>{NOTE_LINE_HEIGHTS.map(height=><option key={height} value={height}>{Math.round(height*100)}%</option>)}</select></label>
   <div className="col-span-2"><NoteColorPicker label="기본 글자색" value={draft.color} onChange={color=>color&&setDraft({...draft,color})}/></div><div className="col-span-2"><NoteColorPicker label="기본 강조색" value={draft.highlight} onChange={highlight=>highlight&&setDraft({...draft,highlight})}/><p className="mt-1 text-[11px] text-app-muted">강조색은 편집 도구에서 선택해 적용해요.</p></div>
  </fieldset>
  {error&&<p role="alert" className="text-xs text-red-600">{error}</p>}{notice&&<p role="status" className="text-xs text-app-accent-ink">{notice}</p>}
  <div className="flex justify-between gap-2"><button type="button" disabled={busy} onClick={()=>{setDraft({...DEFAULT_NOTE_STYLE});setNotice('');}} className="min-h-9 px-3 text-xs text-app-muted rounded-lg hover:bg-app-soft">기본값으로 복원</button><button type="submit" disabled={busy} className="min-h-9 px-3 rounded-lg bg-app-accent-ink text-white text-xs">{busy?'저장 중…':'기본 서식 저장'}</button></div>
 </form>;
}
