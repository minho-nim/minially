import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Schedule,
  Preset,
  CategoryItem,
  RecurrenceRule,
  RecurrenceException,
  AppSettings,
  Task,
  AppData,
  ActiveNavTab,
} from './types';
import {
  initializeDatabase,
  getAllSchedules,
  saveSchedule as dbSaveSchedule,
  deleteSchedule as dbDeleteSchedule,
  batchSaveSchedules,
  batchDeleteSchedules,
  getAllPresets,
  savePreset as dbSavePreset,
  deletePreset as dbDeletePreset,
  markPresetUsed,
  reorderPresets,
  getAllCategories,
  saveCategory as dbSaveCategory,
  deleteCategory as dbDeleteCategory,
  getAllRecurrenceRules,
  getAllRecurrenceExceptions,
  getAllTasks,
  saveTask as dbSaveTask,
  deleteTask as dbDeleteTask,
  getAppSettings,
  saveAppSettings as dbSaveAppSettings,
  exportAllData,
  importAllData,
  resetDatabaseToDefault,
  DEFAULT_SETTINGS,
} from './db/indexedDB';
import { expandRecurringSchedules } from './utils/recurrenceEngine';
import { recordHistory, revertHistoryEntry, UndoNotice } from './utils/undoManager';
import { Navbar } from './components/layout/Navbar';
import { BottomTabBar } from './components/layout/BottomTabBar';
import { CalendarView } from './components/views/CalendarView';
import { TasksView } from './components/views/TasksView';
import { ScheduleModal } from './components/modals/ScheduleModal';
import { DateCopyModal } from './components/modals/DateCopyModal';
import { BatchDateModal } from './components/modals/BatchDateModal';
import { ScheduleMoveModal } from './components/modals/ScheduleMoveModal';
import { SearchModal } from './components/modals/SearchModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { UndoToast } from './components/common/UndoToast';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { getTodayDateString } from './utils/dateHelpers';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('calendar');
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateString());

  // IndexedDB data states
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [recurrenceRules, setRecurrenceRules] = useState<RecurrenceRule[]>([]);
  const [recurrenceExceptions, setRecurrenceExceptions] = useState<RecurrenceException[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Undo state
  const [undoNotice, setUndoNotice] = useState<UndoNotice | null>(null);

  // Modals state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Partial<Schedule> | null>(null);
  const [scheduleSelectedDate, setScheduleSelectedDate] = useState<string | undefined>(undefined);

  const [dateCopyModalOpen, setDateCopyModalOpen] = useState(false);
  const [dateCopySourceDate, setDateCopySourceDate] = useState<string>('');

  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchDefaultDate, setBatchDefaultDate] = useState<string>('');

  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [movingSchedule, setMovingSchedule] = useState<Schedule | null>(null);

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Load and sync data from IndexedDB
  const reloadData = useCallback(async () => {
    try {
      const [
        loadedSchedules,
        loadedPresets,
        loadedCategories,
        loadedRules,
        loadedExceptions,
        loadedTasks,
        loadedSettings,
      ] = await Promise.all([
        getAllSchedules(),
        getAllPresets(),
        getAllCategories(),
        getAllRecurrenceRules(),
        getAllRecurrenceExceptions(),
        getAllTasks(),
        getAppSettings(),
      ]);

      setSchedules(loadedSchedules);
      setPresets(loadedPresets);
      setCategories(loadedCategories);
      setRecurrenceRules(loadedRules);
      setRecurrenceExceptions(loadedExceptions);
      setTasks(loadedTasks);
      setSettings(loadedSettings);
      setIsReady(true);
    } catch (err) {
      console.error('Failed to load data from IndexedDB', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    async function init() {
      await initializeDatabase();
      await reloadData();
    }
    init();
  }, [reloadData]);

  // Expand recurring schedules for the active year/month
  const expandedSchedules = useMemo(() => {
    if (!schedules.length) return [];
    // Define a 6-month window around the selected date
    const [y, m] = selectedDate.split('-').map(Number);
    const viewStart = `${y - 1}-01-01`;
    const viewEnd = `${y + 1}-12-31`;

    return expandRecurringSchedules(
      schedules,
      recurrenceRules,
      recurrenceExceptions,
      viewStart,
      viewEnd
    );
  }, [schedules, recurrenceRules, recurrenceExceptions, selectedDate]);

  // Schedule Actions with Undo
  const handleOpenNewScheduleModal = (defaultDate?: string) => {
    const targetDate = defaultDate || selectedDate || getTodayDateString();
    setScheduleSelectedDate(targetDate);
    setEditingSchedule({
      date: targetDate,
      category: categories[0]?.id || 'personal',
    });
    setScheduleModalOpen(true);
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setScheduleSelectedDate(schedule.date);
    setScheduleModalOpen(true);
  };

  const handleSaveSchedule = async (schedule: Schedule, keepOpen: boolean = false) => {
    const prev = schedules.find((s) => s.id === schedule.id);
    const previousList = prev ? [prev] : [];
    const newList = [schedule];

    await dbSaveSchedule(schedule);

    const desc = prev ? `'${schedule.title}' 수정됨` : `'${schedule.title}' 추가됨`;
    const notice = await recordHistory(prev ? 'UPDATE' : 'CREATE', desc, previousList, newList);
    setUndoNotice(notice);

    await reloadData();

    if (!keepOpen) {
      setScheduleModalOpen(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    const target = schedules.find((s) => s.id === scheduleId);
    if (!target) return;

    await dbDeleteSchedule(scheduleId);
    const notice = await recordHistory('DELETE', `'${target.title}' 삭제됨`, [target], []);
    setUndoNotice(notice);
    await reloadData();
  };

  const handleToggleSchedule = async (scheduleId: string) => {
    const target = schedules.find((s) => s.id === scheduleId);
    if (!target) return;

    const updated: Schedule = {
      ...target,
      completed: !target.completed,
    };

    await dbSaveSchedule(updated);
    const desc = updated.completed ? `'${target.title}' 완료됨` : `'${target.title}' 완료 취소`;
    const notice = await recordHistory('TOGGLE_DONE', desc, [target], [updated]);
    setUndoNotice(notice);
    await reloadData();
  };

  // Move schedule to new date (via drag & drop or move modal)
  const handleMoveSchedule = async (scheduleId: string, newDate: string) => {
    const target = schedules.find((s) => s.id === scheduleId);
    if (!target || target.date === newDate) return;

    const updated: Schedule = {
      ...target,
      date: newDate,
    };

    await dbSaveSchedule(updated);
    const notice = await recordHistory(
      'MOVE',
      `'${target.title}'이(가) ${newDate}로 이동되었습니다`,
      [target],
      [updated]
    );
    setUndoNotice(notice);
    await reloadData();
  };

  // Copy single schedule to new date
  const handleCopySingleSchedule = async (scheduleId: string, targetDate: string) => {
    const target = schedules.find((s) => s.id === scheduleId);
    if (!target) return;

    const newSchedule: Schedule = {
      ...target,
      id: `sch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: targetDate,
      completed: false,
    };

    await dbSaveSchedule(newSchedule);
    const notice = await recordHistory(
      'COPY',
      `'${target.title}'이(가) ${targetDate}로 복사되었습니다`,
      [],
      [newSchedule]
    );
    setUndoNotice(notice);
    await reloadData();
  };

  // Quick Inline Add from Agenda panel
  const handleQuickAddSchedule = async (
    title: string,
    date: string,
    category: Schedule['category']
  ) => {
    const newSchedule: Schedule = {
      id: `sch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      date,
      startTime: '',
      endTime: '',
      category,
      completed: false,
    };

    await dbSaveSchedule(newSchedule);
    const notice = await recordHistory('CREATE', `'${title}' 추가됨`, [], [newSchedule]);
    setUndoNotice(notice);
    await reloadData();
  };

  // Date Copy Modal: Copy all or selected schedules of a date to multiple target dates
  const handleOpenDateCopyModal = (sourceDate: string) => {
    setDateCopySourceDate(sourceDate);
    setDateCopyModalOpen(true);
  };

  const handleConfirmDateCopy = async (selectedScheduleIds: string[], targetDates: string[]) => {
    const sourceItems = schedules.filter((s) => selectedScheduleIds.includes(s.id));
    if (sourceItems.length === 0 || targetDates.length === 0) return;

    const newSchedules: Schedule[] = [];
    for (const d of targetDates) {
      for (const item of sourceItems) {
        newSchedules.push({
          ...item,
          id: `sch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          date: d,
          completed: false,
        });
      }
    }

    await batchSaveSchedules(newSchedules);
    const notice = await recordHistory(
      'COPY',
      `${newSchedules.length}개의 일정이 ${targetDates.length}개 날짜에 복사되었습니다`,
      [],
      newSchedules
    );
    setUndoNotice(notice);
    await reloadData();
  };

  // Batch Date Modal: Register same schedule across multiple dates
  const handleOpenBatchDateModal = (defaultDate: string) => {
    setBatchDefaultDate(defaultDate);
    setBatchModalOpen(true);
  };

  const handleConfirmBatch = async (
    scheduleData: {
      title: string;
      startTime: string;
      endTime: string;
      category: Schedule['category'];
      memo: string;
    },
    dates: string[]
  ) => {
    if (!scheduleData.title.trim() || dates.length === 0) return;

    const newSchedules: Schedule[] = dates.map((d) => ({
      id: `sch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      title: scheduleData.title.trim(),
      date: d,
      startTime: scheduleData.startTime,
      endTime: scheduleData.endTime,
      category: scheduleData.category,
      memo: scheduleData.memo,
      completed: false,
    }));

    await batchSaveSchedules(newSchedules);
    const notice = await recordHistory(
      'BATCH_CREATE',
      `'${scheduleData.title}' 일정이 ${dates.length}개 날짜에 일괄 등록되었습니다`,
      [],
      newSchedules
    );
    setUndoNotice(notice);
    await reloadData();
  };

  // Undo execution handler
  const handleUndo = async (notice: UndoNotice) => {
    try {
      await revertHistoryEntry(notice.entry);
      setUndoNotice(null);
      await reloadData();
    } catch (err) {
      console.error('Failed to undo change', err);
    }
  };

  // Presets Handlers
  const handleSavePreset = async (preset: Preset) => {
    await dbSavePreset(preset);
    setPresets(await getAllPresets());
  };

  const handleDeletePreset = async (presetId: string) => {
    await dbDeletePreset(presetId);
    setPresets(await getAllPresets());
  };

  const handleReorderPresets = async (ids: string[]) => {
    await reorderPresets(ids);
    setPresets(await getAllPresets());
  };

  const handleUsePreset = async (presetId: string) => {
    await markPresetUsed(presetId);
    setPresets(await getAllPresets());
  };

  // Category Handlers
  const handleSaveCategory = async (cat: CategoryItem) => {
    await dbSaveCategory(cat);
    await reloadData();
  };

  const handleDeleteCategory = async (catId: string) => {
    await dbDeleteCategory(catId);
    await reloadData();
  };

  // Settings Handlers
  const handleUpdateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await dbSaveAppSettings(newSettings);
  };

  // Backup & Restore
  const handleExportBackup = async () => {
    const data = await exportAllData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `Minially_Backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (data: Partial<AppData>) => {
    await importAllData(data);
    await reloadData();
  };

  const handleResetData = async () => {
    await resetDatabaseToDefault();
    await reloadData();
  };

  // Tasks Handlers
  const handleToggleTaskStatus = async (taskId: string) => {
    const t = tasks.find((item) => item.id === taskId);
    if (!t) return;
    const updated: Task = {
      ...t,
      status: t.status === 'done' ? 'todo' : 'done',
    };
    await dbSaveTask(updated);
    await reloadData();
  };

  const handleToggleTaskChecklist = async (taskId: string, checklistId: string) => {
    const t = tasks.find((item) => item.id === taskId);
    if (!t || !t.checklist) return;
    const updated: Task = {
      ...t,
      checklist: t.checklist.map((c) => (c.id === checklistId ? { ...c, done: !c.done } : c)),
    };
    await dbSaveTask(updated);
    await reloadData();
  };

  const handleDeleteTask = async (taskId: string) => {
    await dbDeleteTask(taskId);
    await reloadData();
  };

  const handleQuickAddTask = async (title: string, dueDate: string) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title,
      dueDate: dueDate || getTodayDateString(),
      status: 'todo',
      priority: 'medium',
      checklist: [],
    };
    await dbSaveTask(newTask);
    await reloadData();
  };

  const handleBatchDeleteTasks = async (taskIds: string[]) => {
    for (const id of taskIds) {
      await dbDeleteTask(id);
    }
    await reloadData();
  };

  const handleBatchToggleTasks = async (taskIds: string[], targetDone: boolean) => {
    for (const id of taskIds) {
      const t = tasks.find((item) => item.id === id);
      if (t) {
        await dbSaveTask({ ...t, status: targetDone ? 'done' : 'todo' });
      }
    }
    await reloadData();
  };

  // Search Navigation
  const handleSelectScheduleFromSearch = (schedule: Schedule) => {
    setSelectedDate(schedule.date);
    setActiveTab('calendar');
    handleEditSchedule(schedule);
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#FFFAFB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#CF8FA8] text-white flex items-center justify-center font-bold text-base shadow-2xs animate-pulse">
            D
          </div>
          <span className="text-xs font-semibold text-[#85777D]">미니어리 준비 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFAFB] text-[#3E3438] flex flex-col selection:bg-[#F4DCE5]">
      {/* Offline Alert Banner */}
      <OfflineIndicator />

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenNewScheduleModal={() => handleOpenNewScheduleModal()}
        onOpenSettingsModal={() => setSettingsModalOpen(true)}
        onOpenSearchModal={() => setSearchModalOpen(true)}
      />

      {/* Main View Area (Mobile Optimized Max Width) */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-5 pb-24 md:pb-12">
        {/* 1. Calendar View (Default) */}
        {activeTab === 'calendar' && (
          <CalendarView
            schedules={expandedSchedules}
            categories={categories}
            settings={settings}
            selectedDate={selectedDate}
            onSelectDate={(date) => setSelectedDate(date)}
            onOpenNewScheduleModal={handleOpenNewScheduleModal}
            onEditSchedule={handleEditSchedule}
            onToggleSchedule={handleToggleSchedule}
            onMoveSchedule={handleMoveSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onOpenDateCopyModal={handleOpenDateCopyModal}
            onOpenBatchDateModal={handleOpenBatchDateModal}
            onOpenMoveModal={(sch) => {
              setMovingSchedule(sch);
              setMoveModalOpen(true);
            }}
            onQuickAddSchedule={handleQuickAddSchedule}
          />
        )}

        {/* 2. Tasks View */}
        {activeTab === 'tasks' && (
          <TasksView
            tasks={tasks}
            onToggleTaskStatus={handleToggleTaskStatus}
            onToggleTaskChecklist={handleToggleTaskChecklist}
            onDeleteTask={handleDeleteTask}
            onQuickAddTask={handleQuickAddTask}
            onBatchDeleteTasks={handleBatchDeleteTasks}
            onBatchToggleTasks={handleBatchToggleTasks}
          />
        )}
      </main>

      {/* Mobile Sticky Bottom Tab Bar */}
      <BottomTabBar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenNewScheduleModal={() => handleOpenNewScheduleModal()}
        onOpenSearchModal={() => setSearchModalOpen(true)}
        onOpenSettingsModal={() => setSettingsModalOpen(true)}
      />

      {/* Schedule Modal (Planit Fast Registration, Preset Chips, Overlap Alert, Enter to Save) */}
      <ScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onSave={handleSaveSchedule}
        onDelete={handleDeleteSchedule}
        onUsePreset={handleUsePreset}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
        onReorderPresets={handleReorderPresets}
        onOpenBatchModal={handleOpenBatchDateModal}
        initialSchedule={editingSchedule}
        presets={presets}
        categories={categories}
        schedules={schedules}
        selectedDate={scheduleSelectedDate}
      />

      {/* Date Copy Modal ("이 날짜 일정 전체 복사") */}
      <DateCopyModal
        isOpen={dateCopyModalOpen}
        onClose={() => setDateCopyModalOpen(false)}
        sourceDate={dateCopySourceDate}
        sourceSchedules={schedules.filter((s) => s.date === dateCopySourceDate)}
        onConfirmCopy={handleConfirmDateCopy}
      />

      {/* Batch Date Modal ("여러 날짜 일괄 등록") */}
      <BatchDateModal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        categories={categories}
        defaultDate={batchDefaultDate}
        onConfirmBatch={handleConfirmBatch}
      />

      {/* Schedule Move / Copy Modal */}
      <ScheduleMoveModal
        isOpen={moveModalOpen}
        onClose={() => {
          setMoveModalOpen(false);
          setMovingSchedule(null);
        }}
        schedule={movingSchedule}
        onMove={handleMoveSchedule}
        onCopy={handleCopySingleSchedule}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        schedules={schedules}
        categories={categories}
        onSelectSchedule={handleSelectScheduleFromSearch}
      />

      {/* Settings Modal (Presets CRUD, Categories, Calendar, Backup/Restore, PWA) */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        presets={presets}
        categories={categories}
        settings={settings}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
        onReorderPresets={handleReorderPresets}
        onSaveCategory={handleSaveCategory}
        onDeleteCategory={handleDeleteCategory}
        onUpdateSettings={handleUpdateSettings}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onResetData={handleResetData}
      />

      {/* Undo Toast Notification */}
      <UndoToast
        notice={undoNotice}
        onUndo={handleUndo}
        onDismiss={() => setUndoNotice(null)}
      />
    </div>
  );
}
