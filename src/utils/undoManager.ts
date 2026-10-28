import { ChangeHistoryEntry, Schedule, Task } from '../types';
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
