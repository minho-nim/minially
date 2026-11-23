import React from 'react';
import { Check, Settings2 } from 'lucide-react';
import { Preset, PresetGroup } from '../../types';

export function PresetGroupTabs({ groups, value, onChange, unclassified = false, presets, onManage, expandedGroupId }: { groups: PresetGroup[]; value: string; onChange: (id: string) => void; unclassified?: boolean; presets?: Preset[]; onManage?: () => void; expandedGroupId?: string | null }) {
  const visibleGroups = [...[...groups].sort((a, b) => a.sortOrder - b.sortOrder), ...(unclassified ? [{ id: '', name: '미분류' }] : [])];
  if (!visibleGroups.length && !onManage) return null;

  return (
    <section role="group" aria-label="프리셋 그룹 선택" className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold text-app-ink">
            프리셋 그룹
            <span className="rounded-full bg-app-soft px-2 py-0.5 text-[11px] font-medium text-app-accent">{visibleGroups.length}</span>
          </h3>
        </div>
        {onManage && <button type="button" onClick={onManage} className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-app-accent hover:bg-app-soft focus-visible:outline-2 focus-visible:outline-app-accent"><Settings2 aria-hidden="true" className="h-3.5 w-3.5" />그룹 관리</button>}
      </div>
      {!visibleGroups.length && <p className="rounded-2xl border border-dashed border-app-outline bg-app-canvas p-4 text-xs leading-relaxed text-app-muted">그룹 관리에서 첫 그룹을 만들어 보세요.</p>}
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {visibleGroups.map(group => {
          const selected = expandedGroupId === undefined ? value === group.id : expandedGroupId === group.id;
          const count = presets?.filter(p => (groups.some(g => g.id === p.groupId) ? p.groupId : '') === group.id).length;
          return (
            <button key={group.id} type="button" title={group.name} aria-pressed={selected} aria-expanded={expandedGroupId === undefined ? undefined : selected} onClick={() => onChange(group.id)}
              className={'preset-group-chip inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent ' + (selected
                ? 'border-app-outline bg-app-soft text-app-ink'
                : 'border-app-line bg-white text-app-ink hover:border-app-outline hover:bg-app-canvas')}>
              <span className="min-w-0 break-words text-xs font-medium leading-snug">{group.name}</span>
              {count !== undefined && <span className="shrink-0 text-[11px] tabular-nums text-app-muted">{count}개</span>}
              {selected && <Check aria-hidden="true" className="h-3 w-3 shrink-0 text-app-accent" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
