import { useEffect, useState } from 'react';
import { Preset, PresetGroup } from '../types';
const key = 'minially:last-preset-group';
export function usePresetGroup(groups: PresetGroup[], presets: Preset[]) {
  const [saved, setSaved] = useState(() => { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } });
  const hasUnclassified = presets.some(p => !p.groupId || !groups.some(g => g.id === p.groupId));
  const active = groups.some(g => g.id === saved) || (saved === '' && hasUnclassified) ? saved : [...groups].sort((a,b) => a.sortOrder-b.sortOrder)[0]?.id || '';
  const select = (id: string) => { setSaved(id); try { localStorage.setItem(key, id); } catch {} window.dispatchEvent(new Event('preset-selection')); };
  useEffect(() => { const sync = () => { try { setSaved(localStorage.getItem(key) ?? ''); } catch {} }; window.addEventListener('preset-selection', sync); return () => window.removeEventListener('preset-selection', sync); }, []);
  return [active, select, hasUnclassified] as const;
}
