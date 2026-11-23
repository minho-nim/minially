import React, { useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Preset, PresetGroup } from '../../types';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import { DiscardPrompt } from '../common/DiscardPrompt';
import { PhraseManager } from './PhraseManageModal';
interface Props {open:boolean;onClose:()=>void;presets:Preset[];groups:PresetGroup[];onSavePreset:(p:Preset)=>Promise<void>;onDeletePreset:(id:string)=>Promise<void>;onReorderPresets:(ids:string[])=>Promise<void>;}
export function PresetLibraryModal({open,onClose,presets,groups,onSavePreset,onDeletePreset,onReorderPresets}:Props){
 const root=useRef<HTMLDivElement>(null);const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false);
 const guard=useDiscardGuard(dirty,busy);const close=()=>{if(guard.confirming){guard.cancel();return false;}return guard.request(onClose);};
 useLayoutEffect(()=>{if(open){setDirty(false);setBusy(false);guard.cancel();requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>('header button')?.focus());}},[open]);
 useScheduleDialog(open,false,root,close,close);if(!open)return null;
 return <div ref={root} role="dialog" aria-modal="true" aria-label="프리셋" data-preset-overlay className="app-modal preset-library-overlay fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-center justify-center bg-[rgba(52,40,35,0.30)] p-4" onClick={e=>{if(e.target===e.currentTarget){e.stopPropagation();close();}}}>
  <div className="preset-library-surface w-full max-w-xl rounded-3xl border border-app-line bg-white text-app-ink shadow-xl flex flex-col overflow-hidden">
   <header className="shrink-0 px-4 py-2 border-b border-app-line flex items-center gap-3">
    <div className="min-w-0 flex-1"><h2 className="text-base font-bold tracking-tight">프리셋 관리</h2></div>
    <button type="button" aria-label="프리셋 닫기" className="min-h-9 min-w-9 rounded-full flex items-center justify-center text-app-muted hover:bg-app-soft" onClick={close}><X className="w-5 h-5"/></button>
   </header>
   {guard.confirming&&<DiscardPrompt actionLabel="프리셋 작성 취소" onContinue={guard.cancel} onDiscard={guard.discard}/>}
   <div data-preset-content className="flex-1 p-4 min-h-0 overflow-y-auto overscroll-contain bg-white">
    <PhraseManager presets={presets} presetGroups={groups} onSavePreset={onSavePreset} onDeletePreset={onDeletePreset} onReorderPresets={onReorderPresets} hideSearch expandableGroups initialType="all" initialMode="manage" onDirtyChange={setDirty} onBusyChange={setBusy}/>
   </div>
  </div>
 </div>;
}
