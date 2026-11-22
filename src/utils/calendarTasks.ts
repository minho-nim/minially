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

export function hasCalendarTask(tasks: Task[], schedule: Pick<Schedule, 'id' | 'date'> & Partial<Pick<Schedule, 'sourceTaskId' | 'sourceNoteId'>>): boolean {
  return tasks.some(task => (!schedule.id.startsWith('shared~') && (task.id === schedule.sourceTaskId || !!schedule.sourceNoteId && task.sourceNoteId === schedule.sourceNoteId && task.dueDate === schedule.date)) || task.id === calendarTaskId(schedule) ||
    (task.linkedScheduleId === schedule.id && task.dueDate === schedule.date));
}

export function taskFromSchedule(schedule: Schedule): Task {
  return {
    id: calendarTaskId(schedule),
    linkedScheduleId: schedule.id,
    ...(schedule.sourceNoteId && !schedule.id.startsWith('shared~') ? { sourceNoteId: schedule.sourceNoteId } : {}),
    ...(!schedule.id.startsWith('shared~') && schedule.category ? { categoryId: schedule.category } : {}),
    title: schedule.title,
    dueDate: schedule.date,
    status: 'todo',
    priority: schedule.isImportant ? 'high' : 'medium',
    checklist: [],
    memo: schedule.memo || '',
  };
}

/** 할 일의 날짜를 옮겨도 원본 반복 회차를 찾는다. 취소·삭제된 원본은 열지 않는다. */
export function scheduleLinkedToTask(task: Task, schedules: Schedule[], rules: RecurrenceRule[], exceptions: RecurrenceException[]): Schedule | undefined {
  if (!task.linkedScheduleId) return schedules.find(schedule=>schedule.sourceTaskId===task.id || !!task.sourceNoteId && schedule.sourceNoteId===task.sourceNoteId && schedule.date===task.dueDate);
  const direct = schedules.find(schedule => schedule.id === task.linkedScheduleId);
  if (direct) return direct;
  const match = task.linkedScheduleId.match(/^(.*)_rec_(\d{4}-\d{2}-\d{2})$/);
  if (!match) return;
  const base = schedules.find(schedule => schedule.id === match[1]);
  if (!base) return;
  const rule = rules.find(item => item.id === base.recurrenceRuleId || item.scheduleId === base.id);
  const exception = exceptions.find(item => item.ruleId === rule?.id && item.originalDate === match[2]);
  const date = exception?.modifiedSchedule?.date || match[2];
  return calendarSchedulesForDate(schedules, rules, exceptions, date).find(schedule => schedule.id === task.linkedScheduleId);
}
