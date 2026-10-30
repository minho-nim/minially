import React, { useState } from 'react';
import { X, Star, Check } from 'lucide-react';
import { Preset, PresetGroup, TitleBlock } from '../../types';
import { PresetGroupTabs } from './PresetGroupTabs';
import { usePresetGroup } from '../../hooks/usePresetGroup';
import { getPresetBlocks, phraseOrder } from '../../utils/phrases';
export function InlinePresetPicker({presets,presetGroups=[],selectedBlocks=[],options,onAdd,onManage,onClose,dragHandle}:{presets:Preset[];presetGroups?:PresetGroup[];selectedBlocks?:TitleBlock[];options?:React.ReactNode;onAdd:(parts:TitleBlock[],preset:Preset)=>void;onManage:()=>void;onClose:()=>void;dragHandle?:(preset:Preset)=>React.ReactNode}){
 const [query,setQuery]=useState('');
 const [active,setActive,unclassified]=usePresetGroup(presetGroups,presets);
 const items=presets.filter(p=>(p.type||'title')==='title'&&(presetGroups.some(g=>g.id===p.groupId)?p.groupId:'')===active&&p.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b)=>phraseOrder(a)-phraseOrder(b)||a.id.localeCompare(b.id));
 const selected=new Set(selectedBlocks.map(b=>b.presetId).filter(Boolean));
 return <section data-inline-presets aria-label="제목 프리셋 선택" className="mt-2 border border-[#F0E7EB] rounded-xl p-2 bg-white space-y-2 min-w-0">
  <div className="flex items-center justify-between"><h3 className="text-sm font-semibold px-2">단어 선택</h3><button type="button" aria-label="프리셋 패널 닫기" onClick={onClose} className="min-h-11 min-w-11 rounded-full bg-[#F6E8ED] text-[#8F526C] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#BD7F98]"><X className="w-5 h-5"/></button></div>
  <PresetGroupTabs groups={presetGroups} value={active} onChange={id=>{setActive(id);setQuery('');}} unclassified={unclassified}/>
  <input type="search" aria-label="프리셋 검색" placeholder="이 그룹의 단어 검색" value={query} onChange={e=>setQuery(e.target.value)} className="w-full min-w-0 min-h-11 border border-[#F0E7EB] rounded-lg px-3 text-base"/>
  <p className="text-[11px] text-[#85777D] px-2">그룹을 바꿔 가며 단어를 고르면 제목에 차례로 추가돼요.</p>
  <div className="max-h-52 overflow-y-auto overscroll-contain flex flex-wrap content-start gap-2 p-1" aria-label="선택 그룹 프리셋 목록">{items.map(p=><div key={p.id} data-quick-preset={p.id} className="flex items-center min-w-0 max-w-full">{dragHandle?.(p)}<button type="button" data-inline-preset={p.id} data-selected={selected.has(p.id)?'true':undefined} aria-description={selected.has(p.id)?'제목에 추가된 단어. 다시 누르면 한 번 더 추가합니다.':undefined} className={'max-w-full min-w-11 flex items-center gap-1.5 min-h-11 py-2 px-3 text-left text-sm whitespace-normal break-words rounded-lg border '+(selected.has(p.id)?'border-[#CF8FA8] bg-[#F6E8ED] text-[#8F526C]':'border-[#E9CDD8] bg-[#FFFAFB] text-[#3E3438]')} onClick={()=>onAdd(getPresetBlocks(p),p)}><span className="min-w-0 flex-1 break-words">{p.text}</span>{selected.has(p.id)&&<Check aria-hidden="true" className="shrink-0 w-3 h-3"/>}{p.isFavorite&&<Star aria-hidden="true" className="shrink-0 w-3 h-3 text-[#CF8FA8] fill-[#CF8FA8]"/>}</button></div>)}{!items.length&&<p className="text-xs text-[#85777D] py-3">이 그룹에 저장된 단어가 없습니다.</p>}</div>
  <div className="flex flex-wrap items-start justify-between gap-2"><button type="button" className="min-h-11 px-2 text-xs text-[#8F526C]" onClick={onManage}>프리셋 관리</button>{options&&<details className="text-xs text-[#85777D]"><summary aria-label="프리셋 적용 옵션" className="min-h-11 py-3 cursor-pointer">제목 교체 옵션</summary><div className="pb-2">{options}</div></details>}</div>
 </section>;
}
