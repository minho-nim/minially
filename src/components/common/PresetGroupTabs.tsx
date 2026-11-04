import React from 'react';
import { Check, Folder, FolderOpen, Settings2 } from 'lucide-react';
import { Preset, PresetGroup } from '../../types';

export function PresetGroupTabs({ groups, value, onChange, unclassified = false, presets, onManage }: { groups: PresetGroup[]; value: string; onChange: (id: string) => void; unclassified?: boolean; presets?: Preset[]; onManage?: () => void }) {
  const visibleGroups = [...[...groups].sort((a, b) => a.sortOrder - b.sortOrder), ...(unclassified ? [{ id: '', name: '미분류' }] : [])];
  if (!visibleGroups.length && !onManage) return null;

  return (
    <section role="group" aria-label="프리셋 그룹 선택" className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#29351F]">
            프리셋 그룹
            <span className="rounded-full bg-[#F0F4E8] px-2 py-0.5 text-[11px] font-medium text-[#596D32]">{visibleGroups.length}</span>
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-[#68735E]">그룹을 골라 저장한 문구를 확인하세요</p>
        </div>
        {onManage && <button type="button" onClick={onManage} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[#596D32] hover:bg-[#F0F4E8] focus-visible:outline-2 focus-visible:outline-[#596D32]"><Settings2 aria-hidden="true" className="h-3.5 w-3.5" />그룹 관리</button>}
      </div>
      {!visibleGroups.length && <p className="rounded-2xl border border-dashed border-[#CCD8BA] bg-[#FAFBF6] p-4 text-xs leading-relaxed text-[#68735E]">그룹 관리에서 첫 그룹을 만들어 보세요.</p>}
      <div className="grid min-w-0 grid-cols-2 gap-2.5">
        {visibleGroups.map(group => {
          const selected = value === group.id;
          const count = presets?.filter(p => (groups.some(g => g.id === p.groupId) ? p.groupId : '') === group.id).length;
          const Icon = selected ? FolderOpen : Folder;
          return (
            <button key={group.id} type="button" title={group.name} aria-pressed={selected} onClick={() => onChange(group.id)}
              className={'group flex min-h-28 min-w-0 flex-col rounded-2xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#596D32] ' + (selected
                ? 'border-[#A5BC70] bg-[#F1F7E4] text-[#29351F]'
                : 'border-[#E6E9DE] bg-white text-[#414A37] hover:border-[#B9CB93] hover:bg-[#FAFCF5]')}>
              <span className="mb-3 flex w-full items-center justify-between gap-2">
                <span className={'flex h-8 w-8 items-center justify-center rounded-xl ' + (selected ? 'bg-[#D5ED84] text-[#405322]' : 'bg-[#F3F4EF] text-[#8A947C]')}><Icon aria-hidden="true" className="h-4 w-4" /></span>
                <span aria-hidden="true" className={'flex h-5 w-5 items-center justify-center rounded-full border ' + (selected ? 'border-[#596D32] bg-[#596D32] text-white' : 'border-[#DEE3D5] bg-white')}>{selected && <Check className="h-3 w-3" />}</span>
              </span>
              <span className="w-full break-words text-sm font-semibold leading-snug">{group.name}</span>
              <span className="mt-1 text-[11px] text-[#68735E]">{count !== undefined ? '프리셋 ' + count + '개' : selected ? '선택한 그룹' : '그룹 보기'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
