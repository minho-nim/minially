import type { Schedule, Task, RecurrenceRule, RecurrenceException } from '../types';
import { expandRecurringSchedules } from './recurrenceEngine.ts';

export function calendarSchedulesForDate(schedules: Schedule[], rules: RecurrenceRule[], exceptions: RecurrenceException[], date: string): Schedule[] {
  return calendarSchedulesForRange(schedules, rules, exceptions, date, date);
}

export function calendarSchedulesForRange(schedules: Schedule[], rules: RecurrenceRule[], exceptions: RecurrenceException[], start: string, end: string): Schedule[] {
  // Also expand source occurrences moved into the selected range.
  const sources = exceptions.filter(item => item.action === 'modified' && item.modifiedSchedule?.date && item.modifiedSchedule.date >= start && item.modifiedSchedule.date <= end).map(item => item.originalDate);
  const dates = [start, end, ...sources].sort();
  return expandRecurringSchedules(schedules, rules, exceptions, dates[0], dates[dates.length - 1]).filter(item => item.date >= start && item.date <= end);
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
