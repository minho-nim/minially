import React, { useState, useRef, useLayoutEffect } from 'react';
import { GripVertical } from 'lucide-react';
import { Preset, PresetGroup } from '../../types';
import { savePresetGroup, deletePresetGroup, restorePresetGroup, reorderPresetGroups } from '../../db/indexedDB';
import { useDragOrder } from '../../hooks/useDragOrder';
const button='min-h-11 px-3 text-xs rounded-lg border border-[#E9CDD8] text-[#8F526C] bg-[#FFFAFB] disabled:opacity-40';
export function PresetGroupManager({groups,presets,onSelect,onCreated,onDirtyChange,onBusyChange}:{groups:PresetGroup[];presets:Preset[];onSelect:(id:string)=>void;onCreated?:()=>void;onDirtyChange?:(v:boolean)=>void;onBusyChange?:(v:boolean)=>void}) {
 const [editing,setEditing]=useState<string|null>(null),[name,setName]=useState(''),[deleting,setDeleting]=useState<string|null>(null),[remove,setRemove]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [undo,setUndo]=useState<Awaited<ReturnType<typeof deletePresetGroup>>|null>(null); const pending=useRef(false);
 const ordered=[...groups].sort((a,b)=>a.sortOrder-b.sortOrder);
 const dirty=editing!==null && name !== (groups.find(g=>g.id===editing)?.name || '');
 useLayoutEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
 useLayoutEffect(()=>{onBusyChange?.(busy);},[busy,onBusyChange]);
 const run=async(action:()=>Promise<void>)=>{if(pending.current)return;pending.current=true;setBusy(true);setError('');try{await action();window.dispatchEvent(new Event('preset-groups-changed'));}catch(e){setError(e instanceof Error?e.message:'저장하지 못했습니다.');}finally{pending.current=false;setBusy(false);}};
 const drag=useDragOrder(ordered.map(g=>g.id),ids=>void run(()=>reorderPresetGroups(ids)),!busy && editing===null && !deleting);
 const group=groups.find(g=>g.id===deleting),count=presets.filter(p=>p.groupId===deleting).length;
 return <fieldset disabled={busy} className="space-y-3 min-w-0"><h3 className="text-sm font-semibold">프리셋 그룹 관리</h3>{error&&<p role="alert" className="text-xs text-[#C4476B]">{error}</p>}
 {undo&&<div role="status" className="text-xs flex gap-2 items-center"><span>그룹을 삭제했습니다.</span><button className={button} type="button" onClick={()=>void run(async()=>{await restorePresetGroup(undo);onSelect(undo.group.id);setUndo(null);})}>그룹 삭제 실행 취소</button></div>}
 {editing===null&&<button type="button" className={button} onClick={()=>{setEditing('');setName('');}}>프리셋 그룹 추가</button>}
 {editing!==null&&<form aria-label="프리셋 그룹 편집" className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();if(!name.trim())return;void run(async()=>{const old=groups.find(g=>g.id===editing),id=old?.id||crypto.randomUUID();await savePresetGroup({id,name:name.trim(),sortOrder:old?.sortOrder??Math.max(-1,...groups.map(g=>g.sortOrder))+1,createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()});onSelect(id);setEditing(null);setName('');if(!old)onCreated?.();});}}><input aria-label="그룹 이름" className="min-h-11 min-w-0 flex-1 border rounded-lg px-3 text-base" required value={name} onChange={e=>setName(e.target.value)} autoFocus/><button className={button} type="submit">그룹 저장</button><button className={button} type="button" onClick={()=>{setEditing(null);setName('');}}>취소</button></form>}
 {editing===null && <div ref={drag.rootRef} className="space-y-1">{ordered.map(g=><div key={g.id} {...drag.itemProps(g.id)} className="flex items-center gap-1 min-w-0 border-b border-[#F0E7EB]" data-preset-group={g.id}><button type="button" {...drag.handleProps(g.id)} aria-label={g.name+' 그룹 위치 이동'} className="min-h-11 min-w-11 cursor-grab"><GripVertical className="w-4 h-4 mx-auto"/></button><span title={g.name} className="flex-1 min-w-0 break-all text-sm">{g.name}</span><button type="button" disabled={editing!==null} className={button} onClick={()=>{setEditing(g.id);setName(g.name);}}>이름 수정</button><button type="button" disabled={editing!==null} className={button} onClick={()=>{setDeleting(g.id);setRemove(false);}}>삭제</button></div>)}</div>}
 {!groups.length&&<p className="text-xs text-[#85777D]">아직 프리셋 그룹이 없습니다. 직접 그룹을 추가하세요.</p>}
 {group&&<div role="group" aria-label="프리셋 그룹 삭제 확인" className="p-3 space-y-2 bg-[#FFFAFB] rounded-lg text-xs"><p className="break-all">‘{group.name}’ — 이 그룹에는 {count}개의 프리셋이 있습니다. 어떻게 처리할까요?</p><label className="flex items-center min-h-11 gap-2"><input type="radio" name="group-delete" checked={!remove} onChange={()=>setRemove(false)}/>프리셋 유지 — 미분류로 이동</label><label className="flex items-center min-h-11 gap-2"><input type="radio" name="group-delete" checked={remove} onChange={()=>setRemove(true)}/>모두 삭제 — 프리셋 {count}개 삭제</label><button className={button} type="button" onClick={()=>void run(async()=>{const result=await deletePresetGroup(group.id,remove);setUndo(result);setDeleting(null);onSelect('');})}>그룹 삭제 확인</button><button className={button} type="button" onClick={()=>setDeleting(null)}>취소</button></div>}
 </fieldset>;
}
