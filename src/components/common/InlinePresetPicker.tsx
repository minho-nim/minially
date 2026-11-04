import React, { useState } from 'react';
import { X, Star, Check, Search, Settings2 } from 'lucide-react';
import { Preset, PresetGroup, TitleBlock } from '../../types';
import { PresetGroupTabs } from './PresetGroupTabs';
import { usePresetGroup } from '../../hooks/usePresetGroup';
import { getPresetBlocks, phraseOrder } from '../../utils/phrases';
export function InlinePresetPicker({presets,presetGroups=[],selectedBlocks=[],options,onAdd,onManage,onClose,dragHandle,dragProps}:{presets:Preset[];presetGroups?:PresetGroup[];selectedBlocks?:TitleBlock[];options?:React.ReactNode;onAdd:(parts:TitleBlock[],preset:Preset)=>void;onManage:()=>void;onClose:()=>void;dragHandle?:(preset:Preset)=>React.ReactNode;dragProps?:(preset:Preset)=>React.ButtonHTMLAttributes<HTMLButtonElement>}){
 const [query,setQuery]=useState('');
 const [searchOpen,setSearchOpen]=useState(false);
 const [active,setActive,unclassified]=usePresetGroup(presetGroups,presets);
 const items=presets.filter(p=>(p.type||'title')==='title'&&(presetGroups.some(g=>g.id===p.groupId)?p.groupId:'')===active&&p.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b)=>phraseOrder(a)-phraseOrder(b)||a.id.localeCompare(b.id));
 const selected=new Set(selectedBlocks.map(b=>b.presetId).filter(Boolean));
 return <section data-inline-presets aria-label="제목 프리셋 선택" className="mt-2 border border-[#E6E9DE] rounded-xl p-2 bg-white space-y-2 min-w-0">
  <div className="flex items-center gap-1"><h3 className="text-xs font-semibold flex-1 px-1">프리셋</h3><button type="button" aria-label="프리셋 검색 열기" aria-expanded={searchOpen} onClick={()=>{setSearchOpen(v=>!v);setQuery('');}} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-[#68735E]"><Search className="w-4 h-4"/></button><button type="button" aria-label="프리셋 관리" title="프리셋 관리" onClick={onManage} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-[#68735E]"><Settings2 className="w-4 h-4"/></button><button type="button" aria-label="프리셋 패널 닫기" onClick={onClose} className="min-h-11 min-w-11 rounded-lg text-[#506329] flex items-center justify-center"><X className="w-5 h-5"/></button></div>
  <PresetGroupTabs presets={presets} groups={presetGroups} value={active} onChange={id=>{setActive(id);setQuery('');}} unclassified={unclassified}/>
  {searchOpen && <input autoFocus type="search" aria-label="프리셋 검색" placeholder="이 그룹의 단어 검색" value={query} onChange={e=>setQuery(e.target.value)} className="w-full min-w-0 min-h-11 border border-[#E6E9DE] rounded-lg px-3 text-base"/>}
  <div className="max-h-40 overflow-y-auto overscroll-contain flex flex-wrap content-start gap-1.5 p-1" aria-label="선택 그룹 프리셋 목록">{items.map(p=><div key={p.id} data-quick-preset={p.id} className="flex items-center min-w-0 max-w-full">{dragHandle?.(p)}<button {...dragProps?.(p)} type="button" data-inline-preset={p.id} data-selected={selected.has(p.id)?'true':undefined} aria-description={selected.has(p.id)?'제목에 추가된 단어. 다시 누르면 한 번 더 추가합니다.':undefined} className={'max-w-full min-w-11 flex items-center gap-1.5 min-h-11 py-1.5 px-2.5 text-left text-sm whitespace-normal break-words rounded-lg border '+(selected.has(p.id)?'border-[#D5ED84] bg-[#F0F5E5] text-[#506329]':'border-transparent bg-[#F3F5ED] text-[#29351F]')} onClick={()=>onAdd(getPresetBlocks(p),p)}><span className="min-w-0 flex-1 break-words">{p.text}</span>{selected.has(p.id)&&<Check aria-hidden="true" className="shrink-0 w-3 h-3"/>}{p.isFavorite&&<Star aria-hidden="true" className="shrink-0 w-3 h-3 text-[#D5ED84] fill-[#D5ED84]"/>}</button></div>)}{!items.length&&<p className="text-xs text-[#68735E] py-3">이 그룹에 저장된 단어가 없습니다.</p>}</div>
  <div className="flex justify-end">{options&&<details className="text-xs text-[#68735E]"><summary aria-label="프리셋 적용 옵션" className="min-h-11 py-3 cursor-pointer">적용 옵션</summary><div className="pb-2">{options}</div></details>}</div>
 </section>;
}
