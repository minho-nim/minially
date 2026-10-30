import { Preset, TitleBlock } from '../types';

export function getPresetBlocks(preset: Preset): TitleBlock[] {
  const parts = preset.blocks;
  if (Array.isArray(parts) && parts.length && parts.every(b => b && typeof b.text === 'string' && b.text.trim()) && parts.map(b => b.text).join(' ') === preset.text) {
    return parts.map(b => ({ ...b, id: crypto.randomUUID(), presetId: preset.id }));
  }
  return [{ id: crypto.randomUUID(), text: preset.text, presetId: preset.id }];
}

export type PhraseSort = 'manual' | 'recent' | 'usage';
export const phraseOrder = (phrase: Preset) => phrase.sortOrder ?? phrase.order ?? phrase.createdAt;

export function sortPresets(presets: Preset[], mode: PhraseSort = 'manual'): Preset[] {
  return [...presets].sort((a, b) =>
    (mode === 'recent' ? (b.lastUsedAt || 0) - (a.lastUsedAt || 0) : 0) ||
    (mode === 'usage' ? b.usageCount - a.usageCount : 0) ||
    Number(b.isFavorite) - Number(a.isFavorite) ||
    phraseOrder(a) - phraseOrder(b) || a.id.localeCompare(b.id)
  );
}

export function getQuickPresets(presets: Preset[]): Preset[] {
  const titles = presets.filter(p => (p.type || 'title') === 'title');
  const favorites = sortPresets(titles.filter(p => p.isFavorite));
  const others = sortPresets(titles.filter(p => !p.isFavorite), 'recent');
  return [...favorites, ...others].slice(0, 3);
}
