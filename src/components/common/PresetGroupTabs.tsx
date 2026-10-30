import React, { useEffect, useRef } from 'react';
import { PresetGroup } from '../../types';
export function PresetGroupTabs({ groups, value, onChange, unclassified = false }: { groups: PresetGroup[]; value: string; onChange: (id: string) => void; unclassified?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { root.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [value]);
  return <div ref={root} role="group" aria-label="프리셋 그룹 선택" className="flex flex-nowrap gap-1 overflow-x-auto overscroll-x-contain min-w-0 pb-1" style={{touchAction:'pan-x'}}>
    {[...[...groups].sort((a,b) => a.sortOrder-b.sortOrder), ...(unclassified ? [{id:'',name:'미분류'}] : [])].map(group => <button key={group.id} type="button" title={group.name} aria-pressed={value === group.id} onClick={() => onChange(group.id)} className={'shrink-0 max-w-48 truncate min-h-11 px-3 rounded-full text-xs ' + (value === group.id ? 'bg-[#F6E8ED] text-[#8F526C] font-semibold' : 'text-[#85777D] hover:bg-[#FFFAFB]')}>{group.name}</button>)}
  </div>;
}
