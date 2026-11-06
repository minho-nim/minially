import type { CategoryItem } from '../types';

export const CATEGORY_LIMIT = 12;
export const CATEGORY_PALETTE = [
  { name: '로즈 핑크', color: '#CF8FA8' }, { name: '라벤더', color: '#B4A2D3' },
  { name: '스카이 블루', color: '#94BED9' }, { name: '세이지 그린', color: '#9DB6A2' },
  { name: '피치', color: '#E6B49F' }, { name: '베이지', color: '#C8B99E' },
  { name: '더스티 코랄', color: '#D6A4A4' }, { name: '소프트 민트', color: '#A5C5BD' },
  { name: '모브', color: '#B6A2B3' }, { name: '버터 옐로', color: '#D6C796' },
  { name: '페리윙클', color: '#A4ADD0' }, { name: '살구 로즈', color: '#D5ACBB' },
];

export function nextCategoryColor(categories: CategoryItem[]) {
  const used = new Set(categories.map(category => typeof category.color === 'string' ? category.color.toLowerCase() : ''));
  const available = CATEGORY_PALETTE.find(item => !used.has(item.color.toLowerCase()));
  if (available) return available.color;
  // Preserve unusually large legacy libraries without assigning a duplicate color.
  let color = 0x968ba0;
  while (used.has('#' + color.toString(16).padStart(6, '0'))) color++;
  return '#' + color.toString(16).padStart(6, '0');
}

// These exact records were seeded by older releases. Keep used or edited records;
// hide unused samples without deleting them from storage or exported backups.
const legacySamples = [
  { id: 'work', name: '업무', color: '#D98DAA', isDefault: true },
  { id: 'personal', name: '개인', color: '#B08898', isDefault: true },
  { id: 'study', name: '공부/자기계발', color: '#8899B0', isDefault: false },
  { id: 'health', name: '운동/건강', color: '#88B098', isDefault: false },
];
export function visibleCategories(categories: CategoryItem[], used: Set<string>) {
  return categories.filter(cat => cat.isUserManaged || used.has(cat.id) || !legacySamples.some(sample => sample.id === cat.id && sample.name === cat.name && sample.color.toLowerCase() === cat.color?.toLowerCase() && sample.isDefault === cat.isDefault));
}

export function resolveCategoryColor(requested: string, existing: string | undefined, categories: CategoryItem[]): string {
  if (existing) {
    if (requested.toLowerCase() !== existing.toLowerCase()) throw new Error('카테고리 색상은 고정입니다. 이름을 수정해 주세요.');
    return existing;
  }
  const color = requested || nextCategoryColor(categories);
  if (!CATEGORY_PALETTE.some(item => item.color.toLowerCase() === color.toLowerCase())) throw new Error('정해진 카테고리 색상을 선택해 주세요.');
  if (categories.some(item => item.color.toLowerCase() === color.toLowerCase())) throw new Error('이미 사용 중인 색상입니다. 다른 색상을 선택해 주세요.');
  return color;
}
