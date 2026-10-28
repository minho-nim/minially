import { ChangeHistoryEntry, Schedule } from '../types';
import { batchSaveSchedules, batchDeleteSchedules, pushHistory, getLatestHistory, deleteHistory } from '../db/indexedDB';

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

  await pushHistory(entry);

  return {
    id: entry.id,
    message: description,
    entry,
  };
}

export async function revertHistoryEntry(entry: ChangeHistoryEntry): Promise<void> {
  // To revert:
  // 1. Delete items that were created or introduced in newSchedules but were not in previousSchedules
  // 2. Put back items that were in previousSchedules
  const prevIds = new Set(entry.previousSchedules.map((s) => s.id));
  const newIdsToDelete = entry.newSchedules.filter((s) => !prevIds.has(s.id)).map((s) => s.id);

  if (newIdsToDelete.length > 0) {
    await batchDeleteSchedules(newIdsToDelete);
  }

  if (entry.previousSchedules.length > 0) {
    await batchSaveSchedules(entry.previousSchedules);
  }

  await deleteHistory(entry.id);
}
