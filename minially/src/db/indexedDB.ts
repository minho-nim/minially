import {validateNoteDefaults} from '../utils/noteFormatting';
import {validateNoteRegistration,existingNoteRegistration,type NoteRegistrationInput,type NoteRegistrationResult} from '../utils/noteSuggestions';
import { noteTitle, validateNote, validateNoteFolder, visibleNoteFolders } from '../utils/notes';
import { sortPresets } from '../utils/phrases';
import { hasCalendarTask, taskFromSchedule } from '../utils/calendarTasks';
import { CATEGORY_LIMIT, nextCategoryColor, visibleCategories, resolveCategoryColor } from '../utils/categories';
import { openDB, DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import {
  Schedule,
  Preset,
  PresetGroup,
  CategoryItem,
  RecurrenceRule,
  RecurrenceException,
  ChangeHistoryEntry,
  AppSettings,
  Task,
  AppData,
  Note,
  NoteFolder,
} from '../types';

interface DayFlowDBSchema extends DBSchema {
  notes: { key: string; value: Note };
  noteFolders: { key: string; value: NoteFolder };
  schedules: {
    key: string;
    value: Schedule;
    indexes: { 'by-date': string; 'by-category': string };
  };
  presets: {
    key: string;
    value: Preset;
  };
  categories: {
    key: string;
    value: CategoryItem;
  };
  recurrenceRules: {
    key: string;
    value: RecurrenceRule;
    indexes: { 'by-schedule': string };
  };
  recurrenceExceptions: {
    key: string;
    value: RecurrenceException;
    indexes: { 'by-rule': string };
  };
  changeHistory: {
    key: string;
    value: ChangeHistoryEntry;
    indexes: { 'by-timestamp': number };
  };
  tasks: {
    key: string;
    value: Task;
  };
  appSettings: {
    key: string;
    value: AppSettings & { id: string };
  };
}

const DB_NAME = 'DayFlowDB';
const DB_VERSION = 2;

// 예전 버전이 새 사용자에게 자동으로 넣던 기본 카테고리(지금은 넣지 않음). 남아 있는 것을 알아보는 데만 쓴다.
export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'category-work', name: '일', color: '#A4ADD0', sortOrder: 0, isUserManaged: true },
  { id: 'category-important', name: '중요', color: '#B4A2D3', sortOrder: 1, isUserManaged: true },
  { id: 'category-other', name: '기타', color: '#D6C796', sortOrder: 2, isUserManaged: true },
  { id: 'category-date', name: '데이트', color: '#CF8FA8', sortOrder: 3, isUserManaged: true },
];

export const DEFAULT_PRESETS: Preset[] = [];

export const DEFAULT_SETTINGS: AppSettings = {
  startDayOfWeek: 0, // Sunday
  defaultCategory: '',
  defaultView: 'month',
  showCompletedInCalendar: true,
  vibrateOnAction: true,
};

let dbPromise: Promise<IDBPDatabase<DayFlowDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<DayFlowDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DayFlowDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('noteFolders')) {
          db.createObjectStore('noteFolders', { keyPath: 'id' });
        }
        // schedules
        if (!db.objectStoreNames.contains('schedules')) {
          const scheduleStore = db.createObjectStore('schedules', { keyPath: 'id' });
          scheduleStore.createIndex('by-date', 'date');
          scheduleStore.createIndex('by-category', 'category');
        }

        // presets
        if (!db.objectStoreNames.contains('presets')) {
          db.createObjectStore('presets', { keyPath: 'id' });
        }

        // categories
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }

        // recurrenceRules
        if (!db.objectStoreNames.contains('recurrenceRules')) {
          const ruleStore = db.createObjectStore('recurrenceRules', { keyPath: 'id' });
          ruleStore.createIndex('by-schedule', 'scheduleId');
        }

        // recurrenceExceptions
        if (!db.objectStoreNames.contains('recurrenceExceptions')) {
          const exStore = db.createObjectStore('recurrenceExceptions', { keyPath: 'id' });
          exStore.createIndex('by-rule', 'ruleId');
        }

        // changeHistory
        if (!db.objectStoreNames.contains('changeHistory')) {
          const historyStore = db.createObjectStore('changeHistory', { keyPath: 'id' });
          historyStore.createIndex('by-timestamp', 'timestamp');
        }

        // tasks
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id' });
        }

        // appSettings
        if (!db.objectStoreNames.contains('appSettings')) {
          db.createObjectStore('appSettings', { keyPath: 'id' });
        }
      },
      blocked() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('database-update-blocked')); },
      blocking() { const closing = dbPromise; dbPromise = null; void closing?.then(db => db.close()); },
    });
  }
  return dbPromise;
}

// Format YYYY-MM-DD
function getTodayDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Shift date by offset days
function shiftDateStr(base: string, offsetDays: number): string {
  const [y, m, d] = base.split('-').map(Number);
  const date = new Date(y, m - 1, d + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Initialize and migrate data from localStorage if IndexedDB is empty
 */
export async function initializeDatabase(): Promise<void> {
  const db = await getDB();

  const existingSettings = await db.get('appSettings', 'global_settings');

  // Check categories
  const catCount = await db.count('categories');
  if (catCount === 0 && !existingSettings) {
    const tx = db.transaction('categories', 'readwrite');
    let legacyCategories: CategoryItem[] = [];
    try { const legacy = JSON.parse(localStorage.getItem('DAYFLOW_APP_DATA_V1') || 'null'); if (Array.isArray(legacy?.categories)) legacyCategories = legacy.categories.filter((cat: CategoryItem) => cat && typeof cat.id === 'string' && typeof cat.name === 'string'); } catch { /* Preserve unreadable legacy storage. */ }
    for (const cat of legacyCategories) {
      await tx.store.put(cat);
    }
    await tx.done;
  }

  // Seed only on first initialization; an intentionally empty list stays empty.
  if (!existingSettings) {
    let legacyPresets: Preset[] | undefined;
    try {
      const legacy = JSON.parse(localStorage.getItem('DAYFLOW_APP_DATA_V1') || 'null');
      if (Array.isArray(legacy?.presets)) legacyPresets = legacy.presets;
    } catch { /* Leave unreadable legacy data untouched. */ }
    const tx = db.transaction(['presets', 'appSettings'], 'readwrite');
    if (await tx.objectStore('presets').count() === 0) {
      for (const preset of legacyPresets ?? DEFAULT_PRESETS) await tx.objectStore('presets').put(preset);
    }
    await tx.objectStore('appSettings').put({ id: 'global_settings', ...DEFAULT_SETTINGS });
    await tx.done;
  }

  // Check schedules and migrate from localStorage if present
  const scheduleCount = await db.count('schedules');
  if (scheduleCount === 0 && !existingSettings) {
    let migratedSchedules: Schedule[] = [];
    let migratedTasks: Task[] = [];

    // Try reading previous localStorage
    try {
      const rawLocal = localStorage.getItem('DAYFLOW_APP_DATA_V1');
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (Array.isArray(parsed.schedules) && parsed.schedules.length > 0) {
          migratedSchedules = parsed.schedules.map((s: any) => ({
            id: s.id || `migrated-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            title: s.title || '새 일정',
            date: s.date || getTodayDateStr(),
            startTime: s.startTime || '',
            endTime: s.endTime || '',
            category: s.category || 'personal',
            linkedProjectId: s.linkedProjectId,
            presetId: s.presetId,
            completed: Boolean(s.completed),
            memo: s.memo || '',
          }));
        }
        if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
          migratedTasks = parsed.tasks.map((t: any) => ({
            id: t.id || `migrated-task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            title: t.title || '새 할 일',
            dueDate: t.dueDate || t.startDate || getTodayDateStr(),
            status: t.status || 'todo',
            priority: t.priority || 'medium',
            checklist: t.checklist || [],
            memo: t.memo || '',
          }));
        }
      }
    } catch (err) {
      console.warn('Could not migrate from localStorage:', err);
    }

    const tx = db.transaction(['schedules', 'tasks'], 'readwrite');
    for (const item of migratedSchedules) {
      await tx.objectStore('schedules').put(item);
    }
    for (const item of migratedTasks) {
      await tx.objectStore('tasks').put(item);
    }
    await tx.done;
  }
  await removeUnusedDefaultCategories();
  await normalizeStoredCategories();
}

// 기본 카테고리는 더 이상 넣지 않는다. 예전에 자동으로 들어간 기본 카테고리 중 이름을 바꾸지 않았고
// 쓰는 일정이 없는 것은 기기마다 한 번만 지운다(그 뒤에 직접 만든 카테고리는 건드리지 않음).
async function removeUnusedDefaultCategories(): Promise<void> {
  const FLAG = 'minially-default-categories-cleared';
  try { if (localStorage.getItem(FLAG)) return; } catch { return; }
  const db = await getDB();
  const tx = db.transaction(['categories', 'schedules', 'recurrenceExceptions'], 'readwrite');
  const schedules = await tx.objectStore('schedules').getAll();
  const exceptions = await tx.objectStore('recurrenceExceptions').getAll();
  const used = new Set([...schedules.map(s => s.category), ...exceptions.map(ex => ex.modifiedSchedule?.category || '')]);
  for (const base of DEFAULT_CATEGORIES) {
    const stored = await tx.objectStore('categories').get(base.id);
    if (stored && stored.name === base.name && !used.has(base.id)) await tx.objectStore('categories').delete(base.id);
  }
  await tx.done;
  try { localStorage.setItem(FLAG, '1'); } catch { /* 다음 실행 때 다시 시도 */ }
}

// Normalize legacy/backup data without deleting categories or changing schedule IDs.
async function normalizeStoredCategories(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['categories', 'schedules', 'recurrenceExceptions', 'changeHistory'], 'readwrite');
  await normalizeCategoryTransaction(tx);
}

async function normalizeCategoryTransaction(tx: IDBPTransaction<DayFlowDBSchema, StoreNames<DayFlowDBSchema>[], 'readwrite'>): Promise<void> {
  try {
    const storedCategories = await tx.objectStore('categories').getAll();
    const schedules = await tx.objectStore('schedules').getAll();
    const exceptions = await tx.objectStore('recurrenceExceptions').getAll();
    const history = await tx.objectStore('changeHistory').getAll();
    const used = new Set([...schedules.map(s => s.category), ...exceptions.map(ex => ex.modifiedSchedule?.category || '')]);
    const categories = visibleCategories(storedCategories, used);
    const assigned: CategoryItem[] = [];
    for (const category of categories) {
      if (!/^#[0-9a-f]{6}$/i.test(category.color || '') || assigned.some(cat => cat.color.toLowerCase() === category.color.toLowerCase())) category.color = nextCategoryColor([...categories, ...assigned]);
      category.isUserManaged = true;
      assigned.push(category);
    }
    const ids = new Set(categories.map(cat => cat.id));
    // 없는 카테고리를 가리키는 일정은 미분류(빈 값)로 돌린다.
    const invalid = (schedule: Partial<Schedule>) => !!schedule.category && !ids.has(schedule.category);
    const invalidException = (ex: RecurrenceException) => ex.modifiedSchedule?.category !== undefined && invalid(ex.modifiedSchedule);
    const fix = (schedule: Schedule): Schedule => invalid(schedule) ? { ...schedule, category: '' } : schedule;
    const fixException = (ex: RecurrenceException): RecurrenceException => invalidException(ex) ? { ...ex, modifiedSchedule: { ...ex.modifiedSchedule, category: '' } } : ex;
    for (const cat of categories) await tx.objectStore('categories').put(cat);
    for (const schedule of schedules) if (invalid(schedule)) await tx.objectStore('schedules').put(fix(schedule));
    for (const ex of exceptions) if (invalidException(ex)) await tx.objectStore('recurrenceExceptions').put(fixException(ex));
    for (const entry of history) await tx.objectStore('changeHistory').put({ ...entry, previousSchedules: entry.previousSchedules.map(fix), newSchedules: entry.newSchedules.map(fix), ...(entry.previousExceptions ? { previousExceptions: entry.previousExceptions.map(fixException) } : {}), ...(entry.newExceptions ? { newExceptions: entry.newExceptions.map(fixException) } : {}) });
    await tx.done;
  } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => {}); throw error; }
}

function requireCategory(schedule: Partial<Schedule>, categories: CategoryItem[]) {
  // 카테고리는 선택 사항(빈 값 = 미분류). 고른 경우에는 있는 카테고리여야 한다.
  if (schedule.category && !categories.some(cat => cat.id === schedule.category)) throw new Error('없는 카테고리입니다. 다시 선택해 주세요.');
}

// Schedule Operations
export async function getAllSchedules(): Promise<Schedule[]> {
  const db = await getDB();
  return db.getAll('schedules');
}

export async function getScheduleById(id: string): Promise<Schedule | undefined> {
  const db = await getDB();
  return db.get('schedules', id);
}

export async function getSchedulesByDate(date: string): Promise<Schedule[]> {
  const db = await getDB();
  const tx = db.transaction('schedules', 'readonly');
  const index = tx.store.index('by-date');
  return index.getAll(date);
}

export async function saveSchedule(schedule: Schedule): Promise<void> {
  await batchSaveSchedules([schedule]);
}

export async function deleteSchedule(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('schedules', id);
}

export async function batchSaveSchedules(schedules: Schedule[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['schedules', 'categories'], 'readwrite');
  try {
    const categories = await tx.objectStore('categories').getAll();
    for (const schedule of schedules) requireCategory(schedule, categories);
    for (const schedule of schedules) await tx.objectStore('schedules').put(schedule);
    await tx.done;
  } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => {}); throw error; }
}

export async function batchDeleteSchedules(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('schedules', 'readwrite');
  for (const id of ids) {
    await tx.store.delete(id);
  }
  await tx.done;
}

// Preset (Phrase) Operations
export async function getAllPresets(): Promise<Preset[]> {
  const db = await getDB();
  // Read and migrate in the same transaction, preserving concurrent writes and every ID.
  const tx = db.transaction('presets', 'readwrite');
  const rawList = await tx.store.getAll();
  const migrated: Preset[] = [];
  const now = Date.now();
  for (const [index, item] of rawList.entries()) {
    const isLegacy = !item.text;
    const normalized: Preset = {
      ...item,
      type: item.type || 'title',
      text: item.text || item.defaultTitle || item.name || '새 문구',
      isFavorite: Boolean(item.isFavorite),
      usageCount: Number.isFinite(item.usageCount) ? Math.max(0, item.usageCount) : 0,
      lastUsedAt: Number.isFinite(item.lastUsedAt) ? item.lastUsedAt : 0,
      sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : (Number.isFinite(item.order) ? item.order! : index),
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || now,
    };
    migrated.push(normalized);
    if (JSON.stringify(item) !== JSON.stringify(normalized)) await tx.store.put(normalized);
    if (isLegacy && item.memo?.trim()) {
      const memo: Preset = {
        id: rawList.some(p => p.id === item.id + '-memo') ? crypto.randomUUID() : item.id + '-memo',
        type: 'memo', text: item.memo, isFavorite: false, usageCount: 0,
        lastUsedAt: 0, sortOrder: normalized.sortOrder + 1, createdAt: now, updatedAt: now,
      };
      migrated.push(memo);
      await tx.store.put(memo);
    }
  }
  await tx.done;
  return sortPresets(migrated);
}

export async function markPresetUsed(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('presets', 'readwrite');
  const item = await tx.store.get(id);
  if (!item) throw new Error('문구를 찾을 수 없습니다.');
  if (item) {
    item.lastUsedAt = Date.now();
    item.usageCount = (item.usageCount || 0) + 1;
    item.updatedAt = Date.now();
    await tx.store.put(item);
  }
  await tx.done;
}

export async function savePreset(preset: Preset): Promise<void> {
  const db = await getDB();
  if (!preset.id || !preset.text?.trim()) throw new Error('문구 내용을 입력해 주세요.');
  const tx = db.transaction(['presets', 'appSettings'], 'readwrite');
  const presetStore = tx.objectStore('presets');
  const existing = await presetStore.get(preset.id);
  const now = Date.now();
  const toSave: Preset = {
    ...existing,
    ...preset,
    id: preset.id,
    type: preset.type || 'title',
    text: (preset.text || '').trim(),
    isFavorite: Boolean(preset.isFavorite),
    usageCount: existing?.usageCount ?? preset.usageCount ?? 0,
    createdAt: existing?.createdAt ?? preset.createdAt ?? now,
    updatedAt: now,
    lastUsedAt: existing?.lastUsedAt ?? preset.lastUsedAt ?? 0,
    sortOrder: existing?.sortOrder ?? existing?.order ?? preset.sortOrder ?? preset.order ?? now,
  };
  if (toSave.blocks && (!Array.isArray(toSave.blocks) || !toSave.blocks.length || toSave.blocks.some(b => !b || typeof b.text !== 'string' || !b.text.trim()) || toSave.blocks.map(b => b.text).join(' ') !== toSave.text)) delete toSave.blocks;
  if (toSave.groupId) { const settings = await tx.objectStore('appSettings').get('global_settings'); if (!settings?.presetGroups?.some(g => g.id === toSave.groupId)) { tx.abort(); await tx.done.catch(() => {}); throw new Error('프리셋 그룹이 없습니다. 그룹을 다시 선택하세요.'); } }
  await presetStore.put(toSave);
  await tx.done;
}

export async function deletePreset(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('presets', id);
}

export async function savePresetGroup(group: PresetGroup): Promise<void> {
  if (!group.id || !group.name.trim()) throw new Error('그룹 이름을 입력하세요.');
  if (group.name.trim() === '미분류') throw new Error('미분류는 시스템 그룹 이름입니다. 다른 이름을 입력하세요.');
  const db = await getDB();
  const tx = db.transaction('appSettings', 'readwrite');
  const settings = await tx.store.get('global_settings') || { ...DEFAULT_SETTINGS, id: 'global_settings' };
  const groups = settings.presetGroups || [];
  if (groups.some(g => g.id !== group.id && g.name.trim() === group.name.trim())) { tx.abort(); await tx.done.catch(() => {}); throw new Error('같은 이름의 그룹이 있습니다.'); }
  await tx.store.put({ ...settings, presetGroups: [...groups.filter(g => g.id !== group.id), { ...group, name: group.name.trim(), createdAt: groups.find(g => g.id === group.id)?.createdAt || group.createdAt || Date.now(), updatedAt: Date.now() }].sort((a, b) => a.sortOrder - b.sortOrder) });
  await tx.done;
}

export async function deletePresetGroup(id: string, removePresets = false) {
  const db = await getDB(), tx = db.transaction(['appSettings', 'presets'], 'readwrite');
  try {
    const settings = await tx.objectStore('appSettings').get('global_settings') || { ...DEFAULT_SETTINGS, id: 'global_settings' };
    const group = settings.presetGroups?.find(g => g.id === id);
    if (!group) throw new Error('그룹이 없습니다.');
    const members = (await tx.objectStore('presets').getAll()).filter(p => p.groupId === id);
    for (const preset of members) {
      if (removePresets) await tx.objectStore('presets').delete(preset.id);
      else { const next = { ...preset, updatedAt: Date.now() }; delete next.groupId; await tx.objectStore('presets').put(next); }
    }
    await tx.objectStore('appSettings').put({ ...settings, presetGroups: (settings.presetGroups || []).filter(g => g.id !== id) });
    await tx.done; return { group, members, removePresets };
  } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => {}); throw error; }
}
export async function restorePresetGroup(snapshot: Awaited<ReturnType<typeof deletePresetGroup>>) {
  const db = await getDB(), tx = db.transaction(['appSettings','presets'], 'readwrite');
  try {
    const settings = await tx.objectStore('appSettings').get('global_settings') || { ...DEFAULT_SETTINGS, id:'global_settings' };
    if (settings.presetGroups?.some(g => g.id === snapshot.group.id || g.name === snapshot.group.name)) throw new Error('같은 그룹이 있어 복구할 수 없습니다.');
    await tx.objectStore('appSettings').put({...settings,presetGroups:[...(settings.presetGroups || []),snapshot.group].sort((a,b)=>a.sortOrder-b.sortOrder)});
    for (const preset of snapshot.members) {
      const current = await tx.objectStore('presets').get(preset.id);
      if (!current || (!snapshot.removePresets && !current.groupId && current.text === preset.text)) await tx.objectStore('presets').put({...preset,...current,updatedAt:preset.updatedAt,groupId:snapshot.group.id});
    }
    await tx.done;
  } catch(error) { try {tx.abort();} catch {} await tx.done.catch(()=>{});throw error; }
}
export async function reorderPresetGroups(ids: string[]) {
  const db = await getDB(), tx = db.transaction('appSettings','readwrite');
  const settings = await tx.store.get('global_settings');
  if (settings) await tx.store.put({...settings,presetGroups:(settings.presetGroups || []).map(g=>({...g,sortOrder:ids.includes(g.id)?ids.indexOf(g.id):g.sortOrder,updatedAt:Date.now()})).sort((a,b)=>a.sortOrder-b.sortOrder)});
  await tx.done;
}

// Update all positions in one transaction, so a failed move cannot save half a swap.
export async function reorderPresets(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('presets', 'readwrite');
  for (const [order, id] of ids.entries()) {
    const phrase = await tx.store.get(id);
    if (phrase) await tx.store.put({ ...phrase, sortOrder: order, order, updatedAt: Date.now() });
  }
  await tx.done;
}

// Category Operations
export async function getAllCategories(): Promise<CategoryItem[]> {
  const db = await getDB();
  const tx = db.transaction(['categories', 'schedules', 'recurrenceExceptions'], 'readonly');
  const [categories, schedules, exceptions] = await Promise.all([tx.objectStore('categories').getAll(), tx.objectStore('schedules').getAll(), tx.objectStore('recurrenceExceptions').getAll()]);
  await tx.done;
  const used = new Set([...schedules.map(s => s.category), ...exceptions.map(ex => ex.modifiedSchedule?.category || '')]);
  return visibleCategories(categories, used).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id));
}

export async function saveCategory(category: CategoryItem): Promise<void> {
  if (!category.id || !category.name?.trim()) throw new Error('카테고리 이름을 입력해 주세요.');
  const db = await getDB();
  const tx = db.transaction(['categories', 'schedules', 'recurrenceExceptions'], 'readwrite');
  try {
    const [categories, schedules, exceptions] = await Promise.all([tx.objectStore('categories').getAll(), tx.objectStore('schedules').getAll(), tx.objectStore('recurrenceExceptions').getAll()]);
    const used = new Set([...schedules.map(s => s.category), ...exceptions.map(ex => ex.modifiedSchedule?.category || '')]);
    const visible = visibleCategories(categories, used);
    if (!visible.some(c => c.id === category.id) && visible.length >= CATEGORY_LIMIT) throw new Error('카테고리는 최대 12개까지 만들 수 있습니다.');
    const existing = categories.find(item => item.id === category.id);
    await tx.objectStore('categories').put({ ...category, color: resolveCategoryColor(category.color, existing?.color, visible), name: category.name.trim(), isUserManaged: true });
    await tx.done;
  } catch (error) { try { tx.abort(); } catch { /* Already aborted. */ } await tx.done.catch(() => {}); throw error; }
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['categories', 'schedules', 'recurrenceExceptions', 'presets', 'appSettings', 'changeHistory'], 'readwrite');
  try {
    const categories = await tx.objectStore('categories').getAll();
    const schedules = await tx.objectStore('schedules').getAll();
    const exceptions = await tx.objectStore('recurrenceExceptions').getAll();
    // 이 카테고리를 쓰던 일정은 미분류(빈 값)가 된다.
    for (const item of schedules) if (item.category === id) await tx.objectStore('schedules').put({ ...item, category: '' });
    for (const ex of exceptions) if (ex.modifiedSchedule?.category === id) await tx.objectStore('recurrenceExceptions').put({ ...ex, modifiedSchedule: { ...ex.modifiedSchedule, category: '' } });
    const replacement = '';
    for (const preset of await tx.objectStore('presets').getAll()) {
      if (preset.defaultCategory === id) await tx.objectStore('presets').put({ ...preset, defaultCategory: '' });
    }
    const settings = await tx.objectStore('appSettings').get('global_settings');
    if (settings?.defaultCategory === id) await tx.objectStore('appSettings').put({ ...settings, defaultCategory: '' });
    for (const entry of await tx.objectStore('changeHistory').getAll()) {
      const clearReference = (schedule: Schedule) => schedule.category === id ? { ...schedule, category: replacement } : schedule;
      const clearException = (ex: RecurrenceException) => ex.modifiedSchedule?.category === id ? { ...ex, modifiedSchedule: { ...ex.modifiedSchedule, category: replacement } } : ex;
      await tx.objectStore('changeHistory').put({ ...entry, previousSchedules: entry.previousSchedules.map(clearReference), newSchedules: entry.newSchedules.map(clearReference), ...(entry.previousExceptions ? { previousExceptions: entry.previousExceptions.map(clearException) } : {}), ...(entry.newExceptions ? { newExceptions: entry.newExceptions.map(clearException) } : {}) });
    }
    await tx.objectStore('categories').delete(id);
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* Already aborted. */ }
    await tx.done.catch(() => {});
    throw error;
  }
}

export async function reorderCategories(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('categories', 'readwrite');
  for (const [sortOrder, id] of ids.entries()) {
    const category = await tx.store.get(id);
    if (category) await tx.store.put({ ...category, sortOrder });
  }
  await tx.done;
}

// Recurrence Rules
export async function getAllRecurrenceRules(): Promise<RecurrenceRule[]> {
  const db = await getDB();
  return db.getAll('recurrenceRules');
}

export async function saveRecurrenceRule(rule: RecurrenceRule): Promise<void> {
  const db = await getDB();
  await db.put('recurrenceRules', rule);
}

export async function deleteRecurrenceRule(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('recurrenceRules', id);
}

// Recurrence Exceptions
export async function getAllRecurrenceExceptions(): Promise<RecurrenceException[]> {
  const db = await getDB();
  return db.getAll('recurrenceExceptions');
}

export async function saveRecurrenceException(exception: RecurrenceException): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['recurrenceExceptions', 'categories'], 'readwrite');
  try {
    if (exception.modifiedSchedule?.category !== undefined) requireCategory(exception.modifiedSchedule, await tx.objectStore('categories').getAll());
    await tx.objectStore('recurrenceExceptions').put(exception);
    await tx.done;
  } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => {}); throw error; }
}

// Tasks Operations
export async function getAllTasks(): Promise<Task[]> {
  const db = await getDB();
  return db.getAll('tasks');
}

export async function saveTask(task: Task): Promise<void> {
  const db = await getDB();
  await db.put('tasks', task);
}

export async function rescheduleTask(id: string, date: string): Promise<void> {
  if (date) {
    const parsed = new Date(date + 'T00:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(date.slice(0,4)) || parsed.getMonth()+1 !== Number(date.slice(5,7)) || parsed.getDate() !== Number(date.slice(8,10))) throw new Error('올바른 날짜를 선택해 주세요.');
  }
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  try {
    const task = await tx.store.get(id);
    if (!task) throw new Error('할 일을 찾을 수 없습니다.');
    await tx.store.put({ ...task, dueDate: date || undefined });
    await tx.done;
  } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => {}); throw error; }
}

// Read and insert in one transaction so concurrent tabs cannot overwrite a task.
export async function saveCalendarTask(schedule: Schedule): Promise<boolean> {
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  try {
    const existing = await tx.store.getAll();
    if (hasCalendarTask(existing, schedule)) {
      await tx.done;
      return false;
    }
    await tx.store.add(taskFromSchedule(schedule));
    await tx.done;
    return true;
  } catch (error) {
    try { tx.abort(); } catch { /* Already completed or aborted. */ }
    await tx.done.catch(() => {});
    throw error;
  }
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tasks', id);
}

// Settings
export async function getAppSettings(): Promise<AppSettings> {
  const db = await getDB(), tx = db.transaction('appSettings','readwrite');
  const res = await tx.store.get('global_settings');
  if (!res) { await tx.done; return DEFAULT_SETTINGS; }
  const { id, ...settings } = res;
  if (settings.presetGroups) {
    const now=Date.now();
    const groups=settings.presetGroups.map(g=>({...g,createdAt:g.createdAt||now,updatedAt:g.updatedAt||g.createdAt||now}));
    if(JSON.stringify(groups)!==JSON.stringify(settings.presetGroups))await tx.store.put({...res,presetGroups:groups});
    settings.presetGroups=groups;
  }
  await tx.done;
  // 일부 값만 있는 설정(예: 일부만 담긴 백업)도 빠진 값은 기본값으로 채운다. 시작 요일이 없으면 달력 칸이 그려지지 않았다.
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  if(settings.noteDefaults!==undefined)validateNoteDefaults(settings.noteDefaults);
  const db = await getDB();
  await db.put('appSettings', { id: 'global_settings', ...settings });
}

// Change History (Undo)
export async function pushHistory(entry: ChangeHistoryEntry): Promise<void> {
  const db = await getDB();
  await db.put('changeHistory', entry);
}

export async function getLatestHistory(): Promise<ChangeHistoryEntry | undefined> {
  const db = await getDB();
  const tx = db.transaction('changeHistory', 'readonly');
  const index = tx.store.index('by-timestamp');
  const all = await index.getAll();
  return all.length > 0 ? all[all.length - 1] : undefined;
}

export async function deleteHistory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('changeHistory', id);
}

// Full Export / Import
export async function exportAllData(): Promise<AppData> {
  const db = await getDB();
  const [schedules, presets, categories, recurrenceRules, recurrenceExceptions, tasks, settings, notes, noteFolders] =
    await Promise.all([
      db.getAll('schedules'),
      db.getAll('presets'),
      db.getAll('categories'),
      db.getAll('recurrenceRules'),
      db.getAll('recurrenceExceptions'),
      db.getAll('tasks'),
      getAppSettings(),
      db.getAll('notes'),
      db.getAll('noteFolders'),
    ]);

  return {
    schedules,
    presets,
    categories,
    recurrenceRules,
    recurrenceExceptions,
    tasks,
    settings,
    notes,
    noteFolders,
  };
}

const BACKUP_STORES = ['categories', 'presets', 'schedules', 'tasks', 'recurrenceRules', 'recurrenceExceptions', 'notes', 'noteFolders'] as const;
/** 백업 파일 검사(쓰기 전에 모두 확인해, 틀리면 지금 데이터를 하나도 바꾸지 않는다) */
function validateBackup(data: Partial<AppData>) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('잘못된 백업 파일입니다.');
  if(data.settings?.noteDefaults!==undefined)validateNoteDefaults(data.settings.noteDefaults);
  const stores = BACKUP_STORES;
  if (!stores.some(key => Array.isArray(data[key]))) throw new Error('백업 데이터가 없습니다.');
  // Validate before opening a write transaction; keep all current data on failure.
  for (const store of stores) {
    if (data[store] === undefined) continue;
    if (!Array.isArray(data[store])) throw new Error('잘못된 백업 목록입니다.');
    const ids = new Set<string>();
    for (const item of data[store]!) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error('잘못되거나 중복된 ID입니다.');
      ids.add(item.id);
      if (store === 'notes') validateNote(item as Note);
      if (store === 'noteFolders') validateNoteFolder(item as NoteFolder);
      if (store === 'presets') {
        const phrase = item as Preset;
        if (!(phrase.text || phrase.defaultTitle || phrase.name)?.trim()) throw new Error('문구 내용이 없습니다.');
      }
    }
  }
  if (data.settings?.presetGroups !== undefined) {
    if (!Array.isArray(data.settings.presetGroups)) throw new Error('잘못된 프리셋 그룹 목록입니다.');
    const groupIds = new Set<string>();
    for (const group of data.settings.presetGroups) {
      if (!group || typeof group.id !== 'string' || !group.id || typeof group.name !== 'string' || !group.name.trim() || !Number.isFinite(group.sortOrder) || groupIds.has(group.id)) throw new Error('잘못되거나 중복된 프리셋 그룹입니다.');
      groupIds.add(group.id);
    }
  }
}

export async function importAllData(data: Partial<AppData>): Promise<void> {
  validateBackup(data);
  const stores = BACKUP_STORES;
  const db = await getDB();
  const tx = db.transaction([...stores, 'appSettings', 'changeHistory'] as const, 'readwrite');
  try {
    for (const store of stores) {
      const items = data[store];
      if (!items) continue;
      await tx.objectStore(store).clear();
      for (const item of items) await tx.objectStore(store).put(item);
    }
    if (data.settings) await tx.objectStore('appSettings').put({ ...data.settings, id: 'global_settings' });
    await normalizeCategoryTransaction(tx);
  } catch (error) {
    try { tx.abort(); } catch { /* Transaction may already have aborted. */ }
    await tx.done.catch(() => {});
    throw error;
  }
}

/** 백업 합치기(기본 복원): 지금 데이터는 지우지 않는다. 없는 항목은 더하고, 같은 항목은 백업 쪽 수정 시각이 더 최신일 때만 바꾼다.
 *  (수정 시각이 없는 항목은 지금 것을 그대로 둔다.) 설정은 바꾸지 않는다. */
export async function mergeAllData(data: Partial<AppData>): Promise<{ added: number; updated: number; kept: number }> {
  validateBackup(data);
  const db = await getDB();
  const tx = db.transaction([...BACKUP_STORES, 'appSettings', 'changeHistory'] as const, 'readwrite');
  const result = { added: 0, updated: 0, kept: 0 };
  try {
    for (const store of BACKUP_STORES) {
      const items = data[store];
      if (!items) continue;
      const os = tx.objectStore(store);
      for (const item of items as { id: string; updatedAt?: number }[]) {
        const current = await os.get(item.id) as { updatedAt?: number } | undefined;
        if (!current) { await os.put(item as never); result.added++; continue; }
        if (typeof item.updatedAt === 'number' && (typeof current.updatedAt !== 'number' || item.updatedAt > current.updatedAt)) { await os.put(item as never); result.updated++; }
        else result.kept++;
      }
    }
    // 프리셋 그룹(설정 안에 있음): 없는 그룹만 더한다(다른 설정은 그대로)
    const groups = data.settings?.presetGroups;
    if (groups?.length) {
      const settingsStore = tx.objectStore('appSettings');
      const current = await settingsStore.get('global_settings') as (AppSettings & { id: string }) | undefined;
      if (current) {
        const have = new Set((current.presetGroups ?? []).map(g => g.id));
        const extra = groups.filter(g => !have.has(g.id));
        if (extra.length) await settingsStore.put({ ...current, presetGroups: [...(current.presetGroups ?? []), ...extra] });
      }
    }
    await normalizeCategoryTransaction(tx);
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* 이미 끝났을 수 있다 */ }
    await tx.done.catch(() => {});
    throw error;
  }
  return result;
}

export async function resetDatabaseToDefault(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['schedules', 'presets', 'categories', 'recurrenceRules', 'recurrenceExceptions', 'changeHistory', 'tasks', 'appSettings', 'notes', 'noteFolders'],
    'readwrite'
  );
  await tx.objectStore('schedules').clear();
  await tx.objectStore('presets').clear();
  await tx.objectStore('categories').clear();
  await tx.objectStore('recurrenceRules').clear();
  await tx.objectStore('recurrenceExceptions').clear();
  await tx.objectStore('changeHistory').clear();
  await tx.objectStore('tasks').clear();
  await tx.objectStore('notes').clear();
  await tx.objectStore('noteFolders').clear();
  await tx.objectStore('appSettings').clear();
  await tx.done;

  // reseed
  await initializeDatabase();
}

// Commit the visible schedule change and its undo record as one durable operation.
export async function applyScheduleHistory(entry: ChangeHistoryEntry, undo = false): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['schedules', 'categories', 'tasks', 'recurrenceRules', 'recurrenceExceptions', 'changeHistory'], 'readwrite');
  try {
    const before = undo ? entry.newSchedules : entry.previousSchedules;
    const after = undo ? entry.previousSchedules : entry.newSchedules;
    const categories = await tx.objectStore('categories').getAll();
    for (const schedule of after) requireCategory(schedule, categories);
    const ids = new Set(after.map(s => s.id));
    for (const schedule of before) if (!ids.has(schedule.id)) await tx.objectStore('schedules').delete(schedule.id);
    for (const schedule of after) await tx.objectStore('schedules').put(schedule);
    const beforeExceptions = (undo ? entry.newExceptions : entry.previousExceptions) ?? [];
    const afterExceptions = (undo ? entry.previousExceptions : entry.newExceptions) ?? [];
    const exceptionIds = new Set(afterExceptions.map(ex => ex.id));
    for (const ex of beforeExceptions) if (!exceptionIds.has(ex.id)) await tx.objectStore('recurrenceExceptions').delete(ex.id);
    for (const ex of afterExceptions) {
      if (ex.modifiedSchedule?.category !== undefined) requireCategory(ex.modifiedSchedule, categories);
      await tx.objectStore('recurrenceExceptions').put(ex);
    }
    const beforeRules = (undo ? entry.newRules : entry.previousRules) ?? [];
    const afterRules = (undo ? entry.previousRules : entry.newRules) ?? [];
    const ruleIds = new Set(afterRules.map(rule => rule.id));
    for (const rule of beforeRules) if (!ruleIds.has(rule.id)) await tx.objectStore('recurrenceRules').delete(rule.id);
    for (const rule of afterRules) await tx.objectStore('recurrenceRules').put(rule);
    const beforeTasks = (undo ? entry.newTasks : entry.previousTasks) ?? [];
    const afterTasks = (undo ? entry.previousTasks : entry.newTasks) ?? [];
    const taskIds = new Set(afterTasks.map(t => t.id));
    for (const task of beforeTasks) if (!taskIds.has(task.id)) await tx.objectStore('tasks').delete(task.id);
    for (const task of afterTasks) await tx.objectStore('tasks').put(task);
    if (undo) await tx.objectStore('changeHistory').delete(entry.id);
    else await tx.objectStore('changeHistory').put(entry);
    await tx.done;
  } catch (error) { try { tx.abort(); } catch { /* Already aborted. */ } await tx.done.catch(() => {}); throw error; }
}

// 메모는 일정의 부가 메모와 분리해 저장하며, 로그인 공간과 백업에 함께 포함한다.
export async function getAllNotes(): Promise<Note[]> { return (await getDB()).getAll('notes'); }
export async function getNoteFolders(): Promise<NoteFolder[]> { const db=await getDB(),tx=db.transaction(['notes','noteFolders']); const [folders,notes]=await Promise.all([tx.objectStore('noteFolders').getAll(),tx.objectStore('notes').getAll()]); await tx.done; return visibleNoteFolders(folders,notes); }
export async function saveNote(note: Note, baseUpdatedAt?:number): Promise<Note|undefined> {
 validateNote(note);
 if(baseUpdatedAt!==undefined&&!Number.isFinite(baseUpdatedAt))throw new Error('메모 버전이 올바르지 않습니다.');
 const db=await getDB(),tx=db.transaction('notes','readwrite'),current=await tx.store.get(note.id);
 let copy:Note|undefined;
 if(current&&baseUpdatedAt!==undefined&&current.updatedAt!==baseUpdatedAt&&JSON.stringify({...current,updatedAt:0})!==JSON.stringify({...note,updatedAt:0})){
  const now=Date.now();copy={...current,id:crypto.randomUUID(),title:(current.title||'제목 없는 메모').slice(0,460)+' · 다른 창 수정 사본',conflictOf:current.conflictOf||current.id,conflictAt:now,createdAt:now,updatedAt:now};delete copy.deletedAt;validateNote(copy);await tx.store.put(copy);
 }
 await tx.store.put(note);await tx.done;return copy;
}
/** 확인창을 열 때의 휴지통만 비운다. 그 뒤 수정·복원한 메모는 건드리지 않는다. */
export async function emptyNoteTrash(targets:Pick<Note,'id'|'updatedAt'>[]):Promise<string[]> {
 if(!Array.isArray(targets)||targets.some(target=>!target||typeof target.id!=='string'||!target.id||!Number.isFinite(target.updatedAt)))throw new Error('삭제할 메모를 확인해 주세요.');
 const db=await getDB(),tx=db.transaction('notes','readwrite'),removed:string[]=[];
 try{
  for(const target of targets){
   const current=await tx.store.get(target.id);
   if(!current?.deletedAt||current.updatedAt!==target.updatedAt)continue;
   await tx.store.delete(target.id);removed.push(target.id);
  }
  await tx.done;return removed;
 }catch(error){try{tx.abort();}catch{/* 이미 중단된 트랜잭션 */}await tx.done.catch(()=>{});throw error;}
}
/** 분류만 삭제하고 연결된 메모(휴지통 포함)는 내용 그대로 미분류로 옮긴다. */
export async function deleteNoteFolder(id:string):Promise<number>{
 if(typeof id!=='string'||!id)throw new Error('삭제할 분류를 확인해 주세요.');
 const db=await getDB(),tx=db.transaction(['notes','noteFolders'],'readwrite');
 try{const notes=await tx.objectStore('notes').getAll();let count=0;for(const note of notes){if(note.folderId!==id)continue;await tx.objectStore('notes').put({...note,folderId:'',updatedAt:Math.max(Date.now(),note.updatedAt+1)});count++;}await tx.objectStore('noteFolders').delete(id);await tx.done;return count;}
 catch(error){try{tx.abort();}catch{/* 이미 종료된 트랜잭션 */}await tx.done.catch(()=>{});throw error;}
}

export async function saveNoteFolder(folder: NoteFolder): Promise<void> { validateNoteFolder(folder); await (await getDB()).put('noteFolders', {...folder,isUserManaged:true}); }

export async function saveNoteTask(note: Note, date: string, categoryId = '', excerpt?:string, options:Pick<Task,'priority'|'checklist'>={priority:'medium',checklist:[]}): Promise<void> {
  validateNote(note);
  if(excerpt!==undefined&&(typeof excerpt!=='string'||!excerpt.trim()||new TextEncoder().encode(JSON.stringify([excerpt,excerpt])).length>220*1024))throw new Error('연결할 메모 내용을 확인해 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('할 일 날짜를 선택해 주세요.');
  const parsed=new Date(date+'T00:00:00');
  if(Number.isNaN(parsed.getTime())||parsed.getFullYear()!==Number(date.slice(0,4))||parsed.getMonth()+1!==Number(date.slice(5,7))||parsed.getDate()!==Number(date.slice(8,10)))throw new Error('올바른 날짜를 선택해 주세요.');
  const checklist=options.checklist??[];
  if(!['low','medium','high'].includes(options.priority)||!Array.isArray(checklist)||checklist.length>100||checklist.some(item=>!item||typeof item.id!=='string'||!item.id||typeof item.text!=='string'||!item.text.trim()||item.text.length>500||typeof item.done!=='boolean')||new Set(checklist.map(item=>item.id)).size!==checklist.length)throw new Error('우선순위와 체크리스트를 확인해 주세요.');
  if(new TextEncoder().encode(JSON.stringify([note.body,excerpt,checklist])).length>220*1024)throw new Error('할 일 내용이 너무 깁니다. 나눠서 등록해 주세요.');
  const db = await getDB();
  const tx = db.transaction(['tasks', 'categories'], 'readwrite');
  try {
  if (categoryId && !(await tx.objectStore('categories').get(categoryId))) { throw new Error('없는 카테고리입니다. 다시 선택해 주세요.'); }
  const existing = (await tx.objectStore('tasks').getAll()).some(task => task.sourceNoteId === note.id && task.dueDate === date && (task.sourceNoteExcerpt??'')===(excerpt??''));
  if (!existing) await tx.objectStore('tasks').put({id:crypto.randomUUID(), categoryId:categoryId || undefined, title:noteTitle(note), memo:note.body, sourceNoteId:note.id, sourceNoteExcerpt:excerpt, dueDate:date, status:'todo', priority:options.priority, checklist});
  await tx.done;
  }catch(error){try{tx.abort();}catch{/* 이미 종료된 트랜잭션 */}await tx.done.catch(()=>{});if(error instanceof DOMException)throw new Error('할 일을 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.');throw error;}
}

/** 한 메모에서 고른 항목을 한 트랜잭션에 저장한다. 재시도와 동시 등록은 같은 ID를 쓴다. */
export async function registerNoteEntries(note:Note,entries:NoteRegistrationInput[]):Promise<NoteRegistrationResult>{
 validateNote(note);if(!Array.isArray(entries)||entries.length<1||entries.length>30)throw new Error('한 번에 1~30개를 선택해 주세요.');
 entries.forEach(validateNoteRegistration);
 const ids=await Promise.all(entries.map(async entry=>{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([note.id,entry.kind,entry.date,entry.sourceText.trim()])));return 'note-'+entry.kind+'-'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');}));
 const db=await getDB(),tx=db.transaction(['notes','tasks','schedules','categories','changeHistory'],'readwrite');
 try{
  const current=await tx.objectStore('notes').get(note.id);if(!current||current.deletedAt||current.updatedAt!==note.updatedAt)throw new Error('메모 내용이 바뀌었습니다. 닫고 추천을 다시 열어 주세요.');
  const [categories,tasks,schedules]=await Promise.all([tx.objectStore('categories').getAll(),tx.objectStore('tasks').getAll(),tx.objectStore('schedules').getAll()]);
  const createdTasks:Task[]=[],createdSchedules:Schedule[]=[];let skipped=0;
  for(let index=0;index<entries.length;index++){
   const entry=entries[index],id=ids[index];if(!current.body.includes(entry.sourceText)&&!current.title.includes(entry.sourceText))throw new Error('선택한 내용이 원본에 없습니다. 닫고 추천을 다시 열어 주세요.');if(entry.categoryId&&!categories.some(category=>category.id===entry.categoryId))throw new Error('카테고리가 변경되었습니다. 다시 선택해 주세요.');
   if(tasks.some(item=>item.id===id)||schedules.some(item=>item.id===id)||existingNoteRegistration(entry,note.id,tasks,schedules)){skipped++;continue;}
   if(entry.kind==='task'){
    const task:Task={id,title:entry.title.trim(),dueDate:entry.date,categoryId:entry.categoryId||undefined,status:'todo',priority:entry.priority,memo:entry.sourceText,sourceNoteId:note.id,sourceNoteExcerpt:entry.sourceText,checklist:[]};await tx.objectStore('tasks').put(task);tasks.push(task);createdTasks.push(task);
   }else{
    const schedule:Schedule={id,title:entry.title.trim(),date:entry.date,category:entry.categoryId,completed:false,startTime:entry.startTime||undefined,endTime:entry.endTime||undefined,isImportant:entry.priority==='high',memo:entry.sourceText,sourceNoteId:note.id,sourceNoteExcerpt:entry.sourceText};requireCategory(schedule,categories);await tx.objectStore('schedules').put(schedule);schedules.push(schedule);createdSchedules.push(schedule);
   }
  }
  let history:ChangeHistoryEntry|undefined;
  if(createdTasks.length||createdSchedules.length){history={id:crypto.randomUUID(),timestamp:Date.now(),type:'BATCH_CREATE',description:`메모에서 할 일 ${createdTasks.length}개 · 일정 ${createdSchedules.length}개 등록`,previousSchedules:[],newSchedules:createdSchedules,previousTasks:[],newTasks:createdTasks};await tx.objectStore('changeHistory').put(history);}
  await tx.done;return{tasks:createdTasks.length,schedules:createdSchedules.length,skipped,history};
 }catch(error){try{tx.abort();}catch{/* 이미 종료된 트랜잭션 */}await tx.done.catch(()=>{});if(error instanceof DOMException)throw new Error(error.name==='QuotaExceededError'?'저장 공간이 부족합니다. 전체 등록을 취소했으니 공간을 확보한 뒤 다시 시도해 주세요.':'저장하지 못해 전체 등록을 취소했습니다. 다시 시도해 주세요.');throw error;}
}
