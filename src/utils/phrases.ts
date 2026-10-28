import { Preset } from '../types';

export function sortPresets(presets: Preset[], mode: 'manual' | 'recent' | 'usage' = 'manual'): Preset[] {
  return [...presets].sort((a, b) =>
    Number(b.isFavorite) - Number(a.isFavorite) ||
    (mode === 'recent' ? (b.lastUsedAt || 0) - (a.lastUsedAt || 0) : 0) ||
    (mode === 'usage' ? b.usageCount - a.usageCount : 0) ||
    (a.order ?? a.createdAt) - (b.order ?? b.createdAt) || a.id.localeCompare(b.id)
  );
}
