import React from 'react';
import { Check, FolderOpen } from 'lucide-react';
import { Preset, PresetGroup } from '../../types';

export function PresetGroupTabs({ groups, value, onChange, unclassified = false, presets, onManage }: { groups: PresetGroup[]; value: string; onChange: (id: string) => void; unclassified?: boolean; presets?: Preset[]; onManage?: () => void }) {
  const visibleGroups = [
    ...[...groups].sort((a, b) => a.sortOrder - b.sortOrder),
    ...(unclassified ? [{ id: '', name: '미분류' }] : []),
  ];

  if (!visibleGroups.length && !onManage) return null;

  return (
    <div role="group" aria-label="프리셋 그룹 선택" className="min-w-0 rounded-xl border border-[#ECEAEC] bg-[#FAFAFA] p-2.5">
      <div className="mb-2 flex items-center gap-1.5 px-0.5">
        <FolderOpen aria-hidden="true" className="h-4 w-4 shrink-0 text-[#625C60]" />
        <span className="text-xs font-bold text-[#3E3438]">프리셋 그룹</span>
        <span className="text-[11px] text-[#85777D]">{visibleGroups.length}개</span>
        {onManage && <button type="button" onClick={onManage} className="ml-auto min-h-11 shrink-0 rounded-lg border border-[#E5E2E4] bg-white px-3 text-xs font-medium text-[#625C60] hover:bg-[#F2F1F2]">그룹 관리</button>}
      </div>
      {!visibleGroups.length && <p className="px-1 py-2 text-xs text-[#85777D]">그룹 관리에서 프리셋을 담을 그룹을 만들어 보세요.</p>}
      <div className="grid min-w-0 grid-cols-2 gap-2">
        {visibleGroups.map(group => {
          const selected = value === group.id;
          const count = presets?.filter(p => (groups.some(g => g.id === p.groupId) ? p.groupId : '') === group.id).length;
          return (
            <button
              key={group.id}
              type="button"
              title={group.name}
              aria-pressed={selected}
              onClick={() => onChange(group.id)}
              className={'flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7D7479] ' + (selected
                ? 'border-[#9B9297] bg-[#F0EEF0] font-semibold text-[#3E3438]'
                : 'border-[#E5E2E4] bg-white font-medium text-[#625C60] hover:border-[#B5ADB2] hover:bg-[#F5F4F5]')}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm whitespace-normal break-words">{group.name}</span>
                {count !== undefined && <span className={'text-[11px] font-normal ' + 'text-[#797277]'}>프리셋 {count}개</span>}
              </span>
              {selected && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
