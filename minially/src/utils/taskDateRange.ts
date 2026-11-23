export function shiftTaskDateRange(start: string, end: string, direction: number): [string, string] {
  const a = new Date(start + 'T12:00:00'), b = new Date(end + 'T12:00:00');
  const days = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000) + 1;
  a.setDate(a.getDate() + direction * days);
  b.setDate(b.getDate() + direction * days);
  const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return [format(a), format(b)];
}
