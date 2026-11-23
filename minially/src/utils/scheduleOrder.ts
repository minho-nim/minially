import { Schedule } from '../types';

// Time always wins; manual order only breaks ties, including the untimed group.
export function compareSchedules(a: Schedule, b: Schedule) {
  return (a.startTime || '99:99').localeCompare(b.startTime || '99:99') ||
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id);
}

export function canReorderSchedules(a: Schedule, b: Schedule, grouped: boolean) {
  return (a.startTime || '') === (b.startTime || '') && (!grouped || a.category === b.category);
}
