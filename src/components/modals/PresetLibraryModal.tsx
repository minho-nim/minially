import React, { useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Preset, PresetGroup } from '../../types';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import { DiscardPrompt } from '../common/DiscardPrompt';
import { PhraseManager } from './PhraseManageModal';
interface Props {open:boolean;onClose:()=>void;presets:Preset[];groups:PresetGroup[];onSavePreset:(p:Preset)=>Promise<void>;onDeletePreset:(id:string)=>Promise<void>;onReorderPresets:(ids:string[])=>Promise<void>;}
export function PresetLibraryModal({open,onClose,presets,groups,onSavePreset,onDeletePreset,onReorderPresets}:Props){
 const root=useRef<HTMLDivElement>(null);const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[compose,setCompose]=useState(false);
 const guard=useDiscardGuard(dirty,busy);const close=()=>{if(guard.confirming){guard.cancel();return false;}return guard.request(onClose);};
 useLayoutEffect(()=>{if(open){setCompose(false);setDirty(false);setBusy(false);guard.cancel();requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>('header button')?.focus());}},[open]);
 useScheduleDialog(open,false,root,close,close);if(!open)return null;
 return <div ref={root} role="dialog" aria-modal="true" aria-label="프리셋" data-preset-overlay className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[rgba(45,35,40,0.25)]"><div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl max-h-[min(90dvh,var(--modal-height,100dvh))] flex flex-col overflow-hidden safe-bottom"><header className="px-4 py-2 border-b border-[#F0E7EB] flex items-center justify-between"><h2 className="font-bold text-sm">프리셋 관리</h2><button type="button" aria-label="프리셋 닫기" className="min-h-11 min-w-11 flex items-center justify-center" onClick={close}><X className="w-5 h-5"/></button></header>{guard.confirming&&<DiscardPrompt actionLabel="프리셋 작성 취소" onContinue={guard.cancel} onDiscard={guard.discard}/>}
 <div data-preset-content className="p-4 min-h-0 overflow-y-auto space-y-3"><PhraseManager key={String(compose)} presets={presets} presetGroups={groups} onSavePreset={onSavePreset} onDeletePreset={onDeletePreset} onReorderPresets={onReorderPresets} hideSearch composePresets={compose} initialMode={compose?'select':'manage'} onDirtyChange={setDirty} onBusyChange={setBusy}/><details className="text-xs border-t border-[#F0E7EB] pt-2"><summary className="min-h-11 py-3 text-[#85777D] cursor-pointer">추가 옵션</summary><button className="min-h-11 px-2 text-xs text-[#8F526C]" type="button" onClick={()=>guard.request(()=>{setDirty(false);setCompose(!compose);})}>{compose?'프리셋 관리로':'블록 묶음 만들기'}</button></details></div></div></div>;
}
