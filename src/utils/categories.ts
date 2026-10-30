import { CategoryItem } from '../types';

export const CATEGORY_LIMIT = 10;
export const CATEGORY_PALETTE = [
  { name: '로즈 핑크', color: '#CF8FA8' }, { name: '라벤더', color: '#B4A2D3' },
  { name: '스카이 블루', color: '#94BED9' }, { name: '세이지 그린', color: '#9DB6A2' },
  { name: '피치', color: '#E6B49F' }, { name: '베이지', color: '#C8B99E' },
  { name: '더스티 코랄', color: '#D6A4A4' }, { name: '소프트 민트', color: '#A5C5BD' },
  { name: '모브', color: '#B6A2B3' }, { name: '버터 옐로', color: '#D6C796' },
];

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
