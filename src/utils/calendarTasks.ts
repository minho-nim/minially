import type { Schedule, Task, RecurrenceRule, RecurrenceException } from '../types';
import { expandRecurringSchedules } from './recurrenceEngine.ts';

export function calendarSchedulesForDate(schedules: Schedule[], rules: RecurrenceRule[], exceptions: RecurrenceException[], date: string): Schedule[] {
  // Include the source dates of occurrences moved onto this day, even from the future.
  const sourceDates = exceptions.filter(item => item.action === 'modified' && item.modifiedSchedule?.date === date).map(item => item.originalDate);
  const dates = [date, ...sourceDates].sort();
  return expandRecurringSchedules(schedules, rules, exceptions, dates[0], dates[dates.length - 1]).filter(item => item.date === date);
}

export function calendarTaskId(schedule: Pick<Schedule, 'id' | 'date'>): string {
  return 'calendar-task:' + schedule.id + ':' + schedule.date;
}

export function hasCalendarTask(tasks: Task[], schedule: Pick<Schedule, 'id' | 'date'>): boolean {
  return tasks.some(task => task.id === calendarTaskId(schedule) ||
    (task.linkedScheduleId === schedule.id && task.dueDate === schedule.date));
}

export function taskFromSchedule(schedule: Schedule): Task {
  return {
    id: calendarTaskId(schedule),
    linkedScheduleId: schedule.id,
    title: schedule.title,
    dueDate: schedule.date,
    status: 'todo',
    priority: schedule.isImportant ? 'high' : 'medium',
    checklist: [],
    memo: schedule.memo || '',
  };
}
