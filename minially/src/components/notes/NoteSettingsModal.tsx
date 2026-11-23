import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import type {NoteDefaults} from '../../types';
import {useScheduleDialog} from '../../hooks/useScheduleDialog';
import {useDiscardGuard} from '../../hooks/useDiscardGuard';
import {DiscardPrompt} from '../common/DiscardPrompt';
import {NoteDefaultsForm} from './NoteDefaultsForm';
import {useState} from 'react';
export function NoteSettingsModal({value,onSave,onClose}:{value?:NoteDefaults;onSave:(value:NoteDefaults)=>Promise<void>;onClose:()=>void}){
 const root=useRef<HTMLDivElement>(null),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),guard=useDiscardGuard(dirty,busy);const close=()=>{if(guard.confirming){guard.cancel();return false;}return guard.request(onClose);};useScheduleDialog(true,false,root,close,close);
 useEffect(()=>{const frame=requestAnimationFrame(()=>root.current?.querySelector<HTMLSelectElement>('select')?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame);},[]);
 return createPortal(<div ref={root} role="dialog" aria-modal="true" aria-label="메모 설정" className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]" onClick={event=>{if(event.target===event.currentTarget)close();}}><div className="w-full max-w-sm max-h-[calc(var(--modal-height,100dvh)-32px)] rounded-2xl border border-app-line bg-white flex flex-col overflow-hidden shadow-xl"><header className="px-3 py-2 border-b border-app-line flex justify-between items-center"><h2 className="font-bold text-sm">메모 설정</h2><button type="button" aria-label="메모 설정 닫기" onClick={close} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-app-soft"><X size={16}/></button></header><div className="overflow-y-auto overscroll-contain min-h-0 p-3"><NoteDefaultsForm value={value} onSave={onSave} onDirtyChange={setDirty} onBusyChange={setBusy}/></div>{guard.confirming&&<DiscardPrompt title="설정 변경을 취소할까요?" actionLabel="변경 취소" onContinue={guard.cancel} onDiscard={guard.discard}/>}</div></div>,document.body);
}
