import { sortPresets } from '../utils/phrases';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  Schedule,
  Preset,
  CategoryItem,
  RecurrenceRule,
  RecurrenceException,
  ChangeHistoryEntry,
  AppSettings,
  Task,
  AppData,
} from '../types';

interface DayFlowDBSchema extends DBSchema {
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
const DB_VERSION = 1;

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'work', name: '업무', color: '#D98DAA', isDefault: true },
  { id: 'personal', name: '개인', color: '#B08898', isDefault: true },
  { id: 'study', name: '공부/자기계발', color: '#8899B0', isDefault: false },
  { id: 'health', name: '운동/건강', color: '#88B098', isDefault: false },
];

export const DEFAULT_PRESETS: Preset[] = [
  // 제목 문구 프리셋
  {
    id: 'phrase-title-1',
    type: 'title',
    text: '주간 팀 회의 및 업무 공유',
    isFavorite: true,
    usageCount: 0,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    order: 1,
  },
  {
    id: 'phrase-title-2',
    type: 'title',
    text: '모닝 루틴 & 데일리 플래닝',
    isFavorite: true,
    usageCount: 0,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    order: 2,
  },
  {
    id: 'phrase-title-3',
    type: 'title',
    text: '개인 집중 업무 (딥워크)',
    isFavorite: true,
    usageCount: 0,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    order: 3,
  },
  {
    id: 'phrase-title-4',
    type: 'title',
    text: '필라테스 / 헬스 운동',
    isFavorite: true,
    usageCount: 0,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    order: 4,
  },
  {
    id: 'phrase-title-5',
    type: 'title',
    text: '도서관 / 카페 독서',
    isFavorite: false,
    usageCount: 0,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    order: 5,
  },
  {
    id: 'phrase-title-6',
    type: 'title',
    text: '병원 정기 검진',
    isFavorite: false,
    usageCount: 0,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    order: 6,
  },
  {
    id: 'phrase-title-7',
    type: 'title',
    text: '장보기 및 식재료 구매',
    isFavorite: false,
    usageCount: 0,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    order: 7,
  },
  // 메모 문구 프리셋
  {
    id: 'phrase-memo-1',
    type: 'memo',
    text: '준비물 챙기기 & 필수 사항 사전 확인',
    isFavorite: true,
    usageCount: 0,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    order: 1,
  },
  {
    id: 'phrase-memo-2',
    type: 'memo',
    text: '어제 진행사항 점검 및 블로커 공유',
    isFavorite: true,
    usageCount: 0,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    order: 2,
  },
  {
    id: 'phrase-memo-3',
    type: 'memo',
    text: '충분한 수분 섭취 및 스트레칭',
    isFavorite: false,
    usageCount: 0,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    order: 3,
  },
  {
    id: 'phrase-memo-4',
    type: 'memo',
    text: '약속 장소 및 교통편 미리 확인',
    isFavorite: false,
    usageCount: 0,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    order: 4,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  startDayOfWeek: 0, // Sunday
  defaultCategory: 'personal',
  defaultView: 'month',
  showCompletedInCalendar: true,
  vibrateOnAction: true,
};

let dbPromise: Promise<IDBPDatabase<DayFlowDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<DayFlowDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DayFlowDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
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
  if (catCount === 0) {
    const tx = db.transaction('categories', 'readwrite');
    for (const cat of DEFAULT_CATEGORIES) {
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

    // If still empty, provide clean realistic sample schedules
    if (migratedSchedules.length === 0) {
      const today = getTodayDateStr();
      migratedSchedules = [
        {
          id: 'sample-1',
          title: '주간 업무 우선순위 정하기',
          date: today,
          startTime: '09:30',
          endTime: '10:00',
          category: 'work',
          completed: false,
          memo: '이번 주 주요 릴리스 마일스톤 점검',
        },
        {
          id: 'sample-2',
          title: '제품 기능 디자인 리뷰',
          date: today,
          startTime: '14:00',
          endTime: '15:00',
          category: 'work',
          completed: false,
          memo: 'UI 간소화 및 플래닛 스타일 빠른 일정 등록 플로우 확인',
        },
        {
          id: 'sample-3',
          title: '필라테스 레슨',
          date: today,
          startTime: '19:00',
          endTime: '20:00',
          category: 'health',
          completed: false,
          memo: '스트레칭 및 코어 운동',
        },
        {
          id: 'sample-4',
          title: '스페인어 회화 1챕터',
          date: shiftDateStr(today, 1),
          startTime: '21:00',
          endTime: '21:40',
          category: 'study',
          completed: false,
          memo: '팟캐스트 듣기 및 핵심 표현 복습',
        },
        {
          id: 'sample-5',
          title: '친구와 브런치 약속',
          date: shiftDateStr(today, 2),
          startTime: '12:00',
          endTime: '13:30',
          category: 'personal',
          completed: false,
          memo: '연남동 카페',
        },
        {
          id: 'sample-6',
          title: '방 정리 및 계절 옷 정리',
          date: shiftDateStr(today, 3),
          startTime: '',
          endTime: '',
          category: 'personal',
          completed: false,
          memo: '시간 지정 없는 하루 할 일',
        },
      ];
    }

    if (migratedTasks.length === 0) {
      const today = getTodayDateStr();
      migratedTasks = [
        {
          id: 'sample-task-1',
          title: '캘린더 간편 복사 기능 테스트하기',
          dueDate: today,
          status: 'todo',
          priority: 'high',
          checklist: [
            { id: 'c1', text: '단일 일정 복사', done: true },
            { id: 'c2', text: '날짜 전체 일정 복사', done: false },
          ],
          memo: 'Planit 스타일 복사 UX 검증',
        },
        {
          id: 'sample-task-2',
          title: '비타민 및 영양제 구매',
          dueDate: shiftDateStr(today, 2),
          status: 'todo',
          priority: 'medium',
          checklist: [],
          memo: '오메가3, 비타민D',
        },
      ];
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
  const db = await getDB();
  await db.put('schedules', schedule);
}

export async function deleteSchedule(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('schedules', id);
}

export async function batchSaveSchedules(schedules: Schedule[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('schedules', 'readwrite');
  for (const s of schedules) {
    await tx.store.put(s);
  }
  await tx.done;
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
  const rawList = await db.getAll('presets');
  let hasMigration = false;
  const migrated: Preset[] = [];
  const now = Date.now();

  for (const item of rawList) {
    if (!item.text) {
      hasMigration = true;
      // Convert legacy preset to title phrase
      const titlePhrase: Preset = {
        ...item,
        id: item.id,
        type: 'title',
        text: item.defaultTitle || item.name || '새 문구',
        isFavorite: Boolean(item.isFavorite),
        usageCount: typeof item.usageCount === 'number' ? item.usageCount : 0,
        createdAt: item.createdAt || now,
        updatedAt: item.updatedAt || now,
        order: 1,
      };
      migrated.push(titlePhrase);

      // If it had a memo, preserve as memo phrase
      if (item.memo && item.memo.trim()) {
        migrated.push({
          id: rawList.some(p => p.id === `${item.id}-memo`) ? `${item.id}-memo-${crypto.randomUUID()}` : `${item.id}-memo`,
          type: 'memo',
          text: item.memo.trim(),
          isFavorite: false,
          usageCount: 0,
          createdAt: now,
          updatedAt: now,
          order: 2,
        });
      }
    } else {
      // Normalize missing fields if any
      const normalized: Preset = {
        ...item,
        type: item.type || 'title',
        text: (item.text || '').trim(),
        isFavorite: Boolean(item.isFavorite),
        usageCount: typeof item.usageCount === 'number' ? item.usageCount : 0,
        createdAt: item.createdAt || now,
        updatedAt: item.updatedAt || now,
      };
      if (
        item.type !== normalized.type ||
        typeof item.usageCount !== 'number' ||
        !item.createdAt ||
        !item.updatedAt
      ) {
        hasMigration = true;
      }
      migrated.push(normalized);
    }
  }

  if (hasMigration) {
    const tx = db.transaction('presets', 'readwrite');
    for (const p of migrated) {
      await tx.store.put(p);
    }
    await tx.done;
  }

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
  const tx = db.transaction('presets', 'readwrite');
  const existing = await tx.store.get(preset.id);
  const now = Date.now();
  const toSave: Preset = {
    ...existing,
    ...preset,
    id: preset.id,
    type: preset.type || 'title',
    text: (preset.text || '').trim(),
    isFavorite: Boolean(preset.isFavorite),
    usageCount: typeof preset.usageCount === 'number' ? preset.usageCount : (existing?.usageCount || 0),
    createdAt: preset.createdAt || existing?.createdAt || now,
    updatedAt: now,
    lastUsedAt: preset.lastUsedAt || existing?.lastUsedAt,
  };
  await tx.store.put(toSave);
  await tx.done;
}

export async function deletePreset(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('presets', id);
}

// Update all positions in one transaction, so a failed move cannot save half a swap.
export async function reorderPresets(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('presets', 'readwrite');
  for (const [order, id] of ids.entries()) {
    const phrase = await tx.store.get(id);
    if (phrase) await tx.store.put({ ...phrase, order, updatedAt: Date.now() });
  }
  await tx.done;
}

// Category Operations
export async function getAllCategories(): Promise<CategoryItem[]> {
  const db = await getDB();
  return db.getAll('categories');
}

export async function saveCategory(category: CategoryItem): Promise<void> {
  const db = await getDB();
  await db.put('categories', category);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('categories', id);
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
  await db.put('recurrenceExceptions', exception);
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

export async function deleteTask(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tasks', id);
}

// Settings
export async function getAppSettings(): Promise<AppSettings> {
  const db = await getDB();
  const res = await db.get('appSettings', 'global_settings');
  if (res) {
    const { id, ...settings } = res;
    return settings;
  }
  return DEFAULT_SETTINGS;
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
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
  const [schedules, presets, categories, recurrenceRules, recurrenceExceptions, tasks, settings] =
    await Promise.all([
      db.getAll('schedules'),
      db.getAll('presets'),
      db.getAll('categories'),
      db.getAll('recurrenceRules'),
      db.getAll('recurrenceExceptions'),
      db.getAll('tasks'),
      getAppSettings(),
    ]);

  return {
    schedules,
    presets,
    categories,
    recurrenceRules,
    recurrenceExceptions,
    tasks,
    settings,
  };
}

export async function importAllData(data: Partial<AppData>): Promise<void> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('잘못된 백업 파일입니다.');
  const stores = ['categories', 'presets', 'schedules', 'tasks', 'recurrenceRules', 'recurrenceExceptions'] as const;
  if (!stores.some(key => Array.isArray(data[key]))) throw new Error('백업 데이터가 없습니다.');
  // Validate before opening a write transaction; keep all current data on failure.
  for (const store of stores) {
    if (data[store] === undefined) continue;
    if (!Array.isArray(data[store])) throw new Error('잘못된 백업 목록입니다.');
    const ids = new Set<string>();
    for (const item of data[store]!) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error('잘못되거나 중복된 ID입니다.');
      ids.add(item.id);
      if (store === 'presets') {
        const phrase = item as Preset;
        if (!(phrase.text || phrase.defaultTitle || phrase.name)?.trim()) throw new Error('문구 내용이 없습니다.');
      }
    }
  }
  const db = await getDB();
  const tx = db.transaction([...stores, 'appSettings'] as const, 'readwrite');
  try {
    for (const store of stores) {
      const items = data[store];
      if (!items) continue;
      await tx.objectStore(store).clear();
      for (const item of items) await tx.objectStore(store).put(item);
    }
    if (data.settings) await tx.objectStore('appSettings').put({ ...data.settings, id: 'global_settings' });
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* Transaction may already have aborted. */ }
    await tx.done.catch(() => {});
    throw error;
  }
}

export async function resetDatabaseToDefault(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['schedules', 'presets', 'categories', 'recurrenceRules', 'recurrenceExceptions', 'changeHistory', 'tasks', 'appSettings'],
    'readwrite'
  );
  await tx.objectStore('schedules').clear();
  await tx.objectStore('presets').clear();
  await tx.objectStore('categories').clear();
  await tx.objectStore('recurrenceRules').clear();
  await tx.objectStore('recurrenceExceptions').clear();
  await tx.objectStore('changeHistory').clear();
  await tx.objectStore('tasks').clear();
  await tx.objectStore('appSettings').clear();
  await tx.done;

  // reseed
  await initializeDatabase();
}
