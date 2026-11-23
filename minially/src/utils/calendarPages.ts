import { DAYS_KR } from './dateHelpers';
const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function shiftCalendarPage(date: string, mode: 'month' | 'week', direction: number) {
  const base = new Date(date + 'T12:00:00');
  if (mode === 'week') base.setDate(base.getDate() + 7 * direction);
  else {
    const day = base.getDate(); base.setDate(1); base.setMonth(base.getMonth() + direction);
    base.setDate(Math.min(day, new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()));
  }
  return format(base);
}
export function calendarPageDays(date: string, mode: 'month' | 'week', startDay: number, today: string) {
  const base = new Date(date + 'T12:00:00'), month = base.getMonth();
  if (mode === 'month') base.setDate(1);
  const offset = (base.getDay() - startDay + 7) % 7;
  const count = mode === 'week' ? 7 : Math.ceil((offset + new Date(base.getFullYear(), month + 1, 0).getDate()) / 7) * 7;
  base.setDate(base.getDate() - offset);
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(base); day.setDate(base.getDate() + index);
    const dateStr = format(day);
    return { dateStr, dayNum: day.getDate(), dayName: DAYS_KR[day.getDay()], isCurrentMonth: day.getMonth() === month, isToday: dateStr === today };
  });
}
