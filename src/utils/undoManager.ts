import { ChangeHistoryEntry, RecurrenceException, RecurrenceRule, Schedule, Task } from '../types';
import { applyScheduleHistory } from '../db/indexedDB';

export interface UndoNotice {
  id: string;
  message: string;
  entry: ChangeHistoryEntry;
}

export async function recordHistory(
  type: ChangeHistoryEntry['type'],
  description: string,
  previousSchedules: Schedule[],
  newSchedules: Schedule[]
): Promise<UndoNotice> {
  const entry: ChangeHistoryEntry = {
    id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    type,
    description,
    previousSchedules,
    newSchedules,
  };

  await applyScheduleHistory(entry);

  return {
    id: entry.id,
    message: description,
    entry,
  };
}

export async function revertHistoryEntry(entry: ChangeHistoryEntry): Promise<void> {
  await applyScheduleHistory(entry, true);
}

export async function recordTaskDeletion(tasks: Task[]): Promise<UndoNotice> {
  const description = tasks.length === 1 ? "'" + tasks[0].title + "' 삭제됨" : tasks.length + '개 할 일이 삭제되었습니다';
  const entry: ChangeHistoryEntry = { id: crypto.randomUUID(), timestamp: Date.now(), type: 'DELETE', description, previousSchedules: [], newSchedules: [], previousTasks: tasks, newTasks: [] };
  await applyScheduleHistory(entry);
  return { id: entry.id, message: description, entry };
}

// Generated occurrences keep their original series; only this date is changed.
export async function recordOccurrenceHistory(type: ChangeHistoryEntry['type'], description: string, before: Schedule[], after: Schedule[], exceptions: RecurrenceException[], rules?: { before: RecurrenceRule[]; after: RecurrenceRule[] }): Promise<UndoNotice> {
  const previousExceptions: RecurrenceException[] = [], newExceptions: RecurrenceException[] = [];
  const occurrences = before.filter(s => s.recurrenceRuleId && /_rec_\d{4}-\d{2}-\d{2}$/.test(s.id));
  const occurrenceIds = new Set(occurrences.map(s => s.id));
  for (const old of occurrences) {
    const originalDate = old.id.slice(-10);
    const existing = exceptions.find(ex => ex.ruleId === old.recurrenceRuleId && ex.originalDate === originalDate);
    if (existing) previousExceptions.push(existing);
    const next = after.find(s => s.id === old.id);
    const { id, isRecurringInstance, recurrenceRuleId, ...changes } = next || old;
    newExceptions.push({ id: existing?.id || crypto.randomUUID(), ruleId: old.recurrenceRuleId!, originalDate, action: next ? 'modified' : 'cancelled', ...(next ? { modifiedSchedule: { ...existing?.modifiedSchedule, ...changes } } : {}) });
  }
  const entry: ChangeHistoryEntry = { id: crypto.randomUUID(), timestamp: Date.now(), type, description, previousSchedules: before.filter(s => !occurrenceIds.has(s.id)), newSchedules: after.filter(s => !occurrenceIds.has(s.id)), previousExceptions, newExceptions, ...(rules ? { previousRules: rules.before, newRules: rules.after } : {}) };
  await applyScheduleHistory(entry);
  return { id: entry.id, message: description, entry };
}
