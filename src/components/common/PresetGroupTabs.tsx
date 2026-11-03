import React from 'react';
import { Check, FolderOpen } from 'lucide-react';
import { PresetGroup } from '../../types';

export function PresetGroupTabs({ groups, value, onChange, unclassified = false }: { groups: PresetGroup[]; value: string; onChange: (id: string) => void; unclassified?: boolean }) {
  const visibleGroups = [
    ...[...groups].sort((a, b) => a.sortOrder - b.sortOrder),
    ...(unclassified ? [{ id: '', name: '미분류' }] : []),
  ];

  if (!visibleGroups.length) return null;

  return (
    <div role="group" aria-label="프리셋 그룹 선택" className="min-w-0 rounded-xl border border-[#E9DDE3] bg-[#FFFAFB] p-2.5">
      <div className="mb-2 flex items-center gap-1.5 px-0.5">
        <FolderOpen aria-hidden="true" className="h-4 w-4 shrink-0 text-[#8F526C]" />
        <span className="text-xs font-bold text-[#3E3438]">프리셋 그룹</span>
        <span className="ml-auto text-[11px] text-[#85777D]">{visibleGroups.length}개</span>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2">
        {visibleGroups.map(group => {
          const selected = value === group.id;
          return (
            <button
              key={group.id}
              type="button"
              title={group.name}
              aria-pressed={selected}
              onClick={() => onChange(group.id)}
              className={'flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8F526C] ' + (selected
                ? 'border-[#8F526C] bg-[#8F526C] font-bold text-white shadow-sm'
                : 'border-[#E9DDE3] bg-white font-medium text-[#5E4B54] hover:border-[#CF8FA8] hover:bg-[#F6E8ED]')}
            >
              <span className="min-w-0 flex-1 whitespace-normal break-words">{group.name}</span>
              {selected && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
