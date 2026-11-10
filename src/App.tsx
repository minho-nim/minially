import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  reorderCategories,
  deleteCategory as dbDeleteCategory,
  getAllRecurrenceRules,
  getAllRecurrenceExceptions,
  getAllTasks,
  saveTask as dbSaveTask,
  rescheduleTask as dbRescheduleTask,
  saveCalendarTask as dbSaveCalendarTask,
  deleteTask as dbDeleteTask,
  getAppSettings,
  saveAppSettings as dbSaveAppSettings,
  exportAllData,
  importAllData,
  resetDatabaseToDefault,
  DEFAULT_SETTINGS,
} from './db/indexedDB';
import { expandRecurringSchedules } from './utils/recurrenceEngine';
import { recordHistory, recordOccurrenceHistory, recordTaskDeletion, revertHistoryEntry, UndoNotice } from './utils/undoManager';
import { Navbar } from './components/layout/Navbar';
import { BottomTabBar } from './components/layout/BottomTabBar';
import { CalendarView } from './components/views/CalendarView';
import { TasksView } from './components/views/TasksView';
import { ScheduleModal } from './components/modals/ScheduleModal';
import { DateCopyModal } from './components/modals/DateCopyModal';
import { ScheduleMoveModal } from './components/modals/ScheduleMoveModal';
import { SearchModal } from './components/modals/SearchModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { LoginScreen, devSkipLogin } from './components/layout/LoginScreen';
import { ShortcutHelp } from './components/modals/ShortcutHelp';
import { SharedScheduleDetail } from './components/modals/SharedScheduleDetail';
import { useSharedViews, isSharedId, sharedOwner } from './sync/shared';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useScheduleReminders } from './hooks/useScheduleReminders';
import { UndoToast } from './components/common/UndoToast';
import { RegistrationNotice, type RegistrationNoticeData } from './components/common/RegistrationNotice';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { ConfirmDeleteDialog } from './components/modals/ConfirmDeleteDialog';
import { CategoryLibraryModal } from './components/modals/CategoryLibraryModal';
import { PresetLibraryModal } from './components/modals/PresetLibraryModal';
import { DayScheduleSheet } from './components/modals/DayScheduleSheet';
import { TodaySchedulesModal } from './components/modals/TodaySchedulesModal';
import { getTodayDateString } from './utils/dateHelpers';
import { syncEngine } from './sync/syncEngine';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(() => syncEngine.connected || devSkipLogin());
  useEffect(() => syncEngine.subscribe(status => setLoggedIn(status.kind !== 'off' || devSkipLogin())), []);
  // 마지막에 보던 탭을 기억한다. 설치한 앱을 좁은 창으로 처음 열면 '할 일'부터 보여 준다(메모장처럼 옆에 띄워 쓰기).
  const [activeTab, setActiveTabState] = useState<ActiveNavTab>(() => {
    try {
      const saved = localStorage.getItem('minially-last-tab');
      if (saved === 'calendar' || saved === 'tasks') return saved;
    } catch { /* 저장소를 못 쓰면 기본값 */ }
    const installed = window.matchMedia?.('(display-mode: standalone), (display-mode: window-controls-overlay)').matches;
    return installed && window.innerWidth <= 520 ? 'tasks' : 'calendar';
  });
  const setActiveTab = useCallback((tab: ActiveNavTab) => {
    setActiveTabState(tab);
    try { localStorage.setItem('minially-last-tab', tab); } catch { /* 무시 */ }
  }, []);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
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
  const [registrationUndoId,setRegistrationUndoId]=useState<string|null>(null);
  const [registrationNotice,setRegistrationNotice] = useState<RegistrationNoticeData|null>(null);
  useEffect(()=>{if(!registrationNotice)return;const timer=setTimeout(()=>setRegistrationNotice(null),8000);return()=>clearTimeout(timer);},[registrationNotice]);

  // Modals state
  const [daySheetOpen, setDaySheetOpen] = useState(false);
  const dayDetailSaved = useRef<(() => void) | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Partial<Schedule> | null>(null);
  const [scheduleSelectedDate, setScheduleSelectedDate] = useState<string | undefined>(undefined);

  const [dateCopyModalOpen, setDateCopyModalOpen] = useState(false);
  const [dateCopySourceDate, setDateCopySourceDate] = useState<string>('');

  const [initialBatch, setInitialBatch] = useState(false);
  const [presetLibraryOpen, setPresetLibraryOpen] = useState(false);
  const [categoryLibraryOpen, setCategoryLibraryOpen] = useState(false);
  const [todaySchedulesOpen, setTodaySchedulesOpen] = useState(false);
  const [taskSelectedDate, setTaskSelectedDate] = useState(getTodayDateString);
  const [taskSelectedEndDate, setTaskSelectedEndDate] = useState(getTodayDateString);
  const selectTaskRange = (start: string, end: string) => { setTaskSelectedDate(start); setTaskSelectedEndDate(end); };
  const selectTaskDate = (date: string) => selectTaskRange(date, date);
  const [actionError, setActionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [taskDeleteTarget, setTaskDeleteTarget] = useState<Task | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [searchSession, setSearchSession] = useState(0);
  const searchOrigin = useRef<{ date: string; tab: ActiveNavTab } | null>(null);

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
      syncEngine.schedule();
    } catch (err) {
      console.error('Failed to load data from IndexedDB', err);
      throw err;
    }
  }, []);

  useEffect(() => { const refresh = () => { void reloadData(); }; window.addEventListener('preset-groups-changed', refresh); return () => window.removeEventListener('preset-groups-changed', refresh); }, [reloadData]);
  useEffect(() => {
    async function init() {
      await initializeDatabase();
      await reloadData();
      syncEngine.setRemoteChangeHandler(async () => { setUndoNotice(null); await reloadData(); });
      syncEngine.start();
      // 브라우저가 저장 공간이 부족할 때 이 사이트 데이터를 지우지 않도록 요청(특히 아이폰)
      void navigator.storage?.persist?.().catch(() => false);
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

  // 공유 받은 일정(보기 전용)을 내 달력·할 일에 겹쳐 보여 준다.
  const shared = useSharedViews(settings.sharedViews);
  const viewSchedules = useMemo(() => {
    if (!shared.schedules.length) return expandedSchedules;
    const [y] = selectedDate.split('-').map(Number);
    return [...expandedSchedules, ...expandRecurringSchedules(shared.schedules, shared.rules, shared.exceptions, `${y - 1}-01-01`, `${y + 1}-12-31`)];
  }, [expandedSchedules, shared, selectedDate]);
  const viewCategories = useMemo(() => shared.categories.length ? [...categories, ...shared.categories] : categories, [categories, shared.categories]);
  const viewTasks = useMemo(() => shared.tasks.length ? [...tasks, ...shared.tasks] : tasks, [tasks, shared.tasks]);
  const [sharedDetail, setSharedDetail] = useState<Schedule | null>(null);
  useScheduleReminders(expandedSchedules, settings.reminder);
  const readOnly = (id?: string) => { if (!isSharedId(id)) return false; setActionError('공유 받은 일정·할 일은 볼 수만 있어요.'); return true; };

  // Schedule Actions with Undo
  const handleOpenNewScheduleModal = (defaultDate?: string) => {
    const targetDate = defaultDate || selectedDate || getTodayDateString();
    searchOrigin.current = null;
    setInitialBatch(false);
    setScheduleSelectedDate(targetDate);
    setEditingSchedule({
      date: targetDate,
      category: '',
    });
    setScheduleModalOpen(true);
  };

  const handleEditSchedule = (schedule: Schedule) => {
    if (isSharedId(schedule.id)) { setSharedDetail(schedule); return; }
    setInitialBatch(false);
    setEditingSchedule(schedule);
    setScheduleSelectedDate(schedule.date);
    setScheduleModalOpen(true);
  };

  const handleSaveSchedule = async (schedule: Schedule, keepOpen: boolean = false, rule?: RecurrenceRule | null) => {
    setRegistrationNotice(null);
    const prev = expandedSchedules.find((s) => s.id === schedule.id) || schedules.find((s) => s.id === schedule.id);
    if (rule !== undefined) {
      schedule = { ...schedule };
      if (rule) schedule.recurrenceRuleId = rule.id;
      else delete schedule.recurrenceRuleId;
    }
    const previousList = prev ? [prev] : [];
    const newList = [schedule];


    const desc = prev ? `'${schedule.title}' 수정됨` : `'${schedule.title}' 추가됨`;
    const oldRule = recurrenceRules.find(r => r.id === prev?.recurrenceRuleId || r.scheduleId === prev?.id);
    const notice = await recordOccurrenceHistory(prev ? 'UPDATE' : 'CREATE', desc, previousList, newList, recurrenceExceptions, rule === undefined ? undefined : { before: oldRule ? [oldRule] : [], after: rule ? [rule] : [] });
    setUndoNotice(notice);

    await reloadData();
    setSelectedDate(schedule.date);
    dayDetailSaved.current?.(); dayDetailSaved.current = null;

    if (!keepOpen) {
      setScheduleModalOpen(false);
    }
    setRegistrationUndoId(notice.id);
    setRegistrationNotice({undoId:notice.id,id:crypto.randomUUID(),message:prev?'일정이 수정되었습니다':'일정이 등록되었습니다',title:schedule.title,dates:[schedule.date],startTime:schedule.startTime,endTime:schedule.endTime});
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    const target = expandedSchedules.find((s) => s.id === scheduleId) || schedules.find((s) => s.id === scheduleId);
    if (!target) return;

    const notice = await recordOccurrenceHistory('DELETE', `'${target.title}' 삭제됨`, [target], [], recurrenceExceptions);
    setUndoNotice(notice);
    await reloadData();
  };

  const handleToggleSchedule = async (scheduleId: string, occurrence?: Schedule) => {
    if (readOnly(scheduleId)) return;
    const target = occurrence || expandedSchedules.find((s) => s.id === scheduleId) || schedules.find((s) => s.id === scheduleId);
    if (!target) return;

    const updated: Schedule = {
      ...target,
      completed: !target.completed,
    };

    const desc = updated.completed ? `'${target.title}' 완료됨` : `'${target.title}' 완료 취소`;
    const notice = await recordOccurrenceHistory('TOGGLE_DONE', desc, [target], [updated], recurrenceExceptions);
    setUndoNotice(notice);
    await reloadData();
  };

  // Move schedule to new date (via drag & drop or move modal)
  const handleMoveSchedule = async (scheduleId: string, newDate: string) => {
    if (readOnly(scheduleId)) return;
    const target = expandedSchedules.find((s) => s.id === scheduleId) || schedules.find((s) => s.id === scheduleId);
    if (!target || target.date === newDate) return;

    const updated: Schedule = {
      ...target,
      date: newDate,
    };

    const notice = await recordOccurrenceHistory(
      'MOVE',
      `'${target.title}'이(가) ${newDate}로 이동되었습니다`,
      [target],
      [updated], recurrenceExceptions
    );
    setUndoNotice(notice);
    await reloadData();
  };

  // Copy single schedule to new date
  const handleCopySingleSchedule = async (scheduleId: string, targetDate: string) => {
    const target = expandedSchedules.find((s) => s.id === scheduleId) || schedules.find((s) => s.id === scheduleId);
    if (!target) return;

    const newSchedule: Schedule = {
      ...target,
      id: `sch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: targetDate,
      completed: false,
    };

    delete newSchedule.recurrenceRuleId; delete newSchedule.isRecurringInstance;
    const notice = await recordHistory(
      'COPY',
      `'${target.title}'이(가) ${targetDate}로 복사되었습니다`,
      [],
      [newSchedule]
    );
    setUndoNotice(notice);
    await reloadData();
  };

  // Date Copy Modal: Copy all or selected schedules of a date to multiple target dates
  const handleOpenDateCopyModal = (sourceDate: string) => {
    setDateCopySourceDate(sourceDate);
    setDateCopyModalOpen(true);
  };

  const handleConfirmDateCopy = async (selectedScheduleIds: string[], targetDates: string[]) => {
    const sourceItems = expandedSchedules.filter((s) => selectedScheduleIds.includes(s.id));
    if (sourceItems.length === 0 || targetDates.length === 0) return;

    const newSchedules: Schedule[] = [];
    for (const d of targetDates) {
      for (const item of sourceItems) {
        newSchedules.push({
          ...item,
          recurrenceRuleId: undefined, isRecurringInstance: undefined,
          id: `sch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          date: d,
          completed: false,
        });
      }
    }

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
    handleOpenNewScheduleModal(defaultDate);
    setInitialBatch(true);
  };

  const handleConfirmBatch = async (
    scheduleData: Schedule,
    dates: string[]
  ) => {
    if (!scheduleData.title.trim() || dates.length === 0) return;
    setRegistrationNotice(null);

    const newSchedules: Schedule[] = dates.map((d) => ({
      id: `sch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      title: scheduleData.title.trim(),
      date: d,
      startTime: scheduleData.startTime,
      endTime: scheduleData.endTime,
      category: scheduleData.category,
      memo: scheduleData.memo,
      isImportant: Boolean(scheduleData.isImportant),
      ...(scheduleData.titleBlocks ? { titleBlocks: scheduleData.titleBlocks } : {}),
      completed: false,
    }));

    const notice = await recordHistory(
      'BATCH_CREATE',
      `'${scheduleData.title}' 일정이 ${dates.length}개 날짜에 일괄 등록되었습니다`,
      [],
      newSchedules
    );
    setUndoNotice(notice);
    await reloadData();
    setSelectedDate(dates[0]);
    setRegistrationUndoId(notice.id);
    setRegistrationNotice({undoId:notice.id,id:crypto.randomUUID(),message:`일정 ${dates.length}개가 등록되었습니다`,title:scheduleData.title,dates:[...dates].sort(),startTime:scheduleData.startTime,endTime:scheduleData.endTime});
    dayDetailSaved.current?.(); dayDetailSaved.current = null;
  };

  // Undo execution handler
  const handleUndo = async (notice: UndoNotice) => {
    try {
      await revertHistoryEntry(notice.entry);
      setUndoNotice(null);
      if(registrationNotice?.undoId===notice.id)setRegistrationNotice(null);
      await reloadData();
    } catch (err) {
      setActionError('실행 취소하지 못했습니다. 다시 시도해 주세요.');
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
    const remaining = await getAllCategories();
    const replacement = remaining.find(cat => cat.name === '기타')?.id || remaining[0]?.id;
    setUndoNotice(notice => {
      if (!notice) return notice;
      const clearReference = (schedule: Schedule) => schedule.category === catId ? { ...schedule, category: replacement } : schedule;
      const clearException = (ex: RecurrenceException) => ex.modifiedSchedule?.category === catId ? { ...ex, modifiedSchedule: { ...ex.modifiedSchedule, category: replacement } } : ex;
      return { ...notice, entry: { ...notice.entry, previousSchedules: notice.entry.previousSchedules.map(clearReference), newSchedules: notice.entry.newSchedules.map(clearReference), previousExceptions: notice.entry.previousExceptions?.map(clearException), newExceptions: notice.entry.newExceptions?.map(clearException) } };
    });
    await reloadData();
  };

  const handleReorderCategories = async (ids: string[]) => {
    await reorderCategories(ids);
    setCategories(await getAllCategories());
  };

  // Settings Handlers
  const handleUpdateSettings = async (newSettings: AppSettings) => {
    await dbSaveAppSettings(newSettings);
    setSettings(newSettings);
    syncEngine.schedule(); // 설정(공유 범위·같이 보기 등)도 내 다른 기기와 맞춘다
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
    setUndoNotice(null);
    await reloadData();
  };

  const handleResetData = async () => {
    await resetDatabaseToDefault();
    setUndoNotice(null);
    await reloadData();
  };

  // Tasks Handlers
  const handleToggleTaskStatus = async (taskId: string) => {
    if (readOnly(taskId)) return;
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
    if (readOnly(taskId)) return;
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
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    setUndoNotice(await recordTaskDeletion([task]));
    await reloadData();
  };

  const handleQuickAddTask = async (title: string, dueDate: string) => {
    setRegistrationNotice(null);
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title,
      dueDate: dueDate || undefined,
      status: 'todo',
      priority: 'medium',
      checklist: [],
    };
    await dbSaveTask(newTask);
    await reloadData();
    setRegistrationNotice({id:crypto.randomUUID(),message:'할 일이 등록되었습니다',title,dates:newTask.dueDate?[newTask.dueDate]:[],kind:'task'});
  };

  const handleRegisterScheduleAsTask = async (schedule: Schedule) => {
    await dbSaveCalendarTask(schedule);
    await reloadData();
  };

  const handleBatchDeleteTasks = async (taskIds: string[]) => {
    taskIds = taskIds.filter(id => !isSharedId(id));
    setUndoNotice(await recordTaskDeletion(tasks.filter(t => taskIds.includes(t.id))));
    await reloadData();
  };

  const handleBatchToggleTasks = async (taskIds: string[], targetDone: boolean) => {
    taskIds = taskIds.filter(id => !isSharedId(id));
    for (const id of taskIds) {
      const t = tasks.find((item) => item.id === id);
      if (t) {
        await dbSaveTask({ ...t, status: targetDone ? 'done' : 'todo' });
      }
    }
    await reloadData();
  };

  const handleCloseSchedule = () => {
    dayDetailSaved.current = null;
    setScheduleModalOpen(false);
    const origin = searchOrigin.current;
    if (origin) { setSelectedDate(origin.date); setActiveTab(origin.tab); setSearchModalOpen(true); searchOrigin.current = null; }
  };
  const openSearch = () => { searchOrigin.current = null; setSearchSession(key => key + 1); setSearchModalOpen(true); };
  const runAction = async (action: () => Promise<void>) => { setActionError(''); try { await action(); } catch { setActionError('변경사항을 저장하지 못했습니다. 다시 시도해 주세요.'); } };
  // Search Navigation
  const handleSelectScheduleFromSearch = (schedule: Schedule) => {
    searchOrigin.current = { date: selectedDate, tab: activeTab };
    setSelectedDate(schedule.date);
    setActiveTab('calendar');
    handleEditSchedule(schedule);
  };

  const shortcutActions = useMemo(() => ({
    newSchedule: () => handleOpenNewScheduleModal(selectedDate),
    search: openSearch,
    settings: () => setSettingsModalOpen(true),
    today: () => { setActiveTab('calendar'); setSelectedDate(getTodayDateString()); },
    calendarTab: () => setActiveTab('calendar'),
    tasksTab: () => setActiveTab('tasks'),
    todaySchedules: () => { selectTaskDate(getTodayDateString()); setTodaySchedulesOpen(true); },
    help: () => setShortcutHelpOpen(open => !open),
    isCalendar: activeTab === 'calendar',
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [selectedDate, activeTab, isReady]);
  useKeyboardShortcuts(shortcutActions);

  // 작업 표시줄 빠른 메뉴(manifest shortcuts)로 열었을 때: ?action=new|search|today, ?tab=tasks
  const launchHandled = useRef(false);
  useEffect(() => {
    if (!isReady || !loggedIn || launchHandled.current) return;
    launchHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action'), tab = params.get('tab');
    if (!action && !tab) return;
    window.history.replaceState(null, '', window.location.pathname);
    if (tab === 'tasks') setActiveTab('tasks');
    if (action === 'new') shortcutActions.newSchedule();
    if (action === 'search') shortcutActions.search();
    if (action === 'today') shortcutActions.todaySchedules();
  }, [isReady, loggedIn, shortcutActions, setActiveTab]);

  if (!loggedIn) return <LoginScreen />;

  if (!isReady) {
    return (
      <div className="min-h-dvh bg-app-canvas flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-app-accent text-white flex items-center justify-center font-bold text-base shadow-2xs animate-pulse">
            M
          </div>
          <span className="text-xs font-semibold text-app-muted">미니어리 준비 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${activeTab === 'calendar' ? 'h-dvh overflow-hidden' : 'min-h-dvh'} bg-app-canvas text-app-ink flex flex-col selection:bg-app-soft`}>
      {/* Offline Alert Banner */}
      <OfflineIndicator />

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenSettingsModal={() => setSettingsModalOpen(true)}
        onOpenSearchModal={openSearch}
      />

      {registrationNotice && !(daySheetOpen&&activeTab==='calendar') && !scheduleModalOpen && !presetLibraryOpen && !dateCopyModalOpen && !moveModalOpen && !searchModalOpen && !settingsModalOpen && !deleteTarget && !taskDeleteTarget && <RegistrationNotice key={registrationNotice.id} notice={registrationNotice} onDismiss={()=>setRegistrationNotice(null)} onUndo={registrationNotice.undoId&&undoNotice?.id===registrationNotice.undoId?()=>handleUndo(undoNotice):undefined}/>}

      {/* Main View Area (Mobile Optimized Max Width) */}
      <main className="app-main-content flex-1 min-h-0 max-w-4xl w-full mx-auto p-3 sm:p-4 pb-24 md:pb-12">
        {/* 1. Calendar View (Default) */}
        {activeTab === 'calendar' && (
          <CalendarView
            schedules={viewSchedules}
            categories={viewCategories}
            settings={settings}
            selectedDate={selectedDate}
            onSelectDate={(date) => setSelectedDate(date)}
            onOpenDay={date => { setSelectedDate(date); setDaySheetOpen(true); }}
            onOpenNewScheduleModal={handleOpenNewScheduleModal}
            onEditSchedule={handleEditSchedule}
            onToggleSchedule={id => void runAction(() => handleToggleSchedule(id))}
            onMoveSchedule={(id, date) => void runAction(() => handleMoveSchedule(id, date))}
            onDeleteSchedule={id => { if (!readOnly(id)) setDeleteTarget(expandedSchedules.find(s => s.id === id) || null); }}
            onOpenDateCopyModal={handleOpenDateCopyModal}
            onOpenBatchDateModal={handleOpenBatchDateModal}
            onOpenMoveModal={(sch) => {
              if (readOnly(sch.id)) return;
              setMovingSchedule(sch);
              setMoveModalOpen(true);
            }}
            onOpenPresetModal={() => setPresetLibraryOpen(true)}
            onOpenCategoryModal={() => setCategoryLibraryOpen(true)}
          />
        )}

        {/* 2. Tasks View */}
        {activeTab === 'tasks' && (
          <TasksView
            tasks={viewTasks}
            selectedDate={taskSelectedDate} selectedEndDate={taskSelectedEndDate} onSelectDate={selectTaskDate} onSelectRange={selectTaskRange}
            presets={presets}
            presetGroups={settings.presetGroups || []}
            onUsePreset={handleUsePreset}
            onOpenPresetManager={()=>setPresetLibraryOpen(true)}
            onOpenCalendar={() => setTodaySchedulesOpen(true)}
            onRescheduleTask={async(id,date)=>{if(readOnly(id))return;await dbRescheduleTask(id,date);await reloadData();}}
            onToggleTaskStatus={handleToggleTaskStatus}
            onToggleTaskChecklist={handleToggleTaskChecklist}
            onDeleteTask={id => { if (!readOnly(id)) setTaskDeleteTarget(tasks.find(t => t.id === id) || null); }}
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
        onOpenSearchModal={openSearch}
        onOpenSettingsModal={() => setSettingsModalOpen(true)}
      />

      {actionError && <div role="alert" className="mx-auto max-w-4xl p-3 text-sm text-red-600">{actionError}<button type="button" aria-label="오류 알림 닫기" onClick={() => setActionError('')} className="min-h-9 px-3">닫기</button></div>}
      <ConfirmDeleteDialog noun="할 일" target={taskDeleteTarget} busy={deleteBusy} onClose={() => setTaskDeleteTarget(null)} onDelete={async () => { if (!taskDeleteTarget || deleteBusy) return; setDeleteBusy(true); try { await handleDeleteTask(taskDeleteTarget.id); setTaskDeleteTarget(null); } finally { setDeleteBusy(false); } }} />
      <ConfirmDeleteDialog target={deleteTarget} busy={deleteBusy} onClose={() => setDeleteTarget(null)} onDelete={async () => { if (!deleteTarget || deleteBusy) return; setDeleteBusy(true); try { await handleDeleteSchedule(deleteTarget.id); setDeleteTarget(null); } finally { setDeleteBusy(false); } }} />
      <TodaySchedulesModal date={taskSelectedDate} endDate={taskSelectedEndDate} onDateChange={selectTaskDate} onRangeChange={selectTaskRange} open={todaySchedulesOpen} onClose={() => setTodaySchedulesOpen(false)} schedules={schedules} rules={recurrenceRules} exceptions={recurrenceExceptions} categories={categories} tasks={tasks} onToggleSchedule={async schedule=>{await handleToggleSchedule(schedule.id,schedule);}} onRegisterTask={handleRegisterScheduleAsTask} />
      <CategoryLibraryModal open={categoryLibraryOpen} onClose={() => setCategoryLibraryOpen(false)} categories={categories} schedules={schedules} onSaveCategory={handleSaveCategory} onDeleteCategory={handleDeleteCategory} onReorderCategories={handleReorderCategories} />
      <PresetLibraryModal open={presetLibraryOpen} onClose={() => setPresetLibraryOpen(false)} presets={presets} groups={settings.presetGroups || []} onSavePreset={handleSavePreset} onDeletePreset={handleDeletePreset} onReorderPresets={handleReorderPresets} />
      <DayScheduleSheet
        registrationNotice={registrationNotice} onDismissRegistration={()=>setRegistrationNotice(null)} onUndoRegistration={registrationNotice?.undoId&&undoNotice?.id===registrationNotice.undoId?()=>handleUndo(undoNotice):undefined}
        open={daySheetOpen && activeTab === 'calendar' && !categoryLibraryOpen && !presetLibraryOpen && !scheduleModalOpen && !dateCopyModalOpen && !moveModalOpen && !searchModalOpen && !settingsModalOpen && !deleteTarget && !taskDeleteTarget}
        date={selectedDate} onSelectDate={setSelectedDate} onClose={() => setDaySheetOpen(false)}
        schedules={viewSchedules} categorySchedules={schedules} categories={categories} extraCategories={shared.categories} presets={presets} settings={settings}
        undoLabel={undoNotice?.message} onUndo={async () => { if (undoNotice) await handleUndo(undoNotice); }}
        onSave={schedule => handleSaveSchedule(schedule, true)} onEdit={handleEditSchedule}
        onToggle={handleToggleSchedule} onMove={schedule => { if (readOnly(schedule.id)) return; setMovingSchedule(schedule); setMoveModalOpen(true); }}
        onCopyDate={() => handleOpenDateCopyModal(selectedDate)}
        onDetails={(draft, saved, batch=false) => { handleOpenNewScheduleModal(selectedDate); setInitialBatch(batch); setEditingSchedule(draft); dayDetailSaved.current = saved; }}
        onReorder={async next => { next = next.filter(s => !isSharedId(s.id)); const previous = next.map(s => expandedSchedules.find(item => item.id === s.id)!).filter(Boolean); setUndoNotice(await recordOccurrenceHistory('UPDATE', '일정 순서 변경됨', previous, next, recurrenceExceptions)); await reloadData(); }}
        onSettings={handleUpdateSettings} onSavePreset={handleSavePreset} onDeletePreset={handleDeletePreset} onReorderPresets={handleReorderPresets} onUsePreset={handleUsePreset}
        onSaveCategory={handleSaveCategory} onDeleteCategory={handleDeleteCategory} onReorderCategories={handleReorderCategories}
      />
      {/* Schedule Modal (Planit Fast Registration, Preset Chips, Overlap Alert, Enter to Save) */}
      <ScheduleModal
        registrationNotice={registrationNotice} onDismissRegistration={()=>setRegistrationNotice(null)}
        isOpen={scheduleModalOpen}
        onClose={handleCloseSchedule}
        onSave={handleSaveSchedule}
        onDelete={handleDeleteSchedule}
        onUsePreset={handleUsePreset}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
        onReorderPresets={handleReorderPresets}
        initialBatch={initialBatch}
        onSaveBatch={handleConfirmBatch}
        initialSchedule={editingSchedule}
        recurrenceRules={recurrenceRules}
        presetGroups={settings.presetGroups || []}
        presets={presets}
        categories={categories}
        onSaveCategory={handleSaveCategory}
        onDeleteCategory={handleDeleteCategory}
        onReorderCategories={handleReorderCategories}
        schedules={schedules}
        selectedDate={scheduleSelectedDate}
      />

      {/* Date Copy Modal ("이 날짜 일정 전체 복사") */}
      <DateCopyModal
        isOpen={dateCopyModalOpen}
        onClose={() => setDateCopyModalOpen(false)}
        sourceDate={dateCopySourceDate}
        sourceSchedules={expandedSchedules.filter((s) => s.date === dateCopySourceDate)}
        onConfirmCopy={handleConfirmDateCopy}
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
        sessionKey={searchSession}
        onClose={() => setSearchModalOpen(false)}
        schedules={schedules}
        categories={categories}
        onSelectSchedule={handleSelectScheduleFromSearch}
      />

      <ShortcutHelp open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />
      <SharedScheduleDetail schedule={sharedDetail} owner={sharedDetail ? sharedOwner(sharedDetail.id, shared.owners) : ''} color={sharedDetail ? shared.categories.find(c => c.id === sharedDetail.category)?.color : undefined} onClose={() => setSharedDetail(null)} />

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
        schedules={schedules}
        onReorderCategories={handleReorderCategories}
        onUpdateSettings={handleUpdateSettings}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onResetData={handleResetData}
      />

      {/* Undo Toast Notification */}
      <UndoToast
        notice={undoNotice?.id===registrationUndoId || todaySchedulesOpen || categoryLibraryOpen || presetLibraryOpen || daySheetOpen || scheduleModalOpen || dateCopyModalOpen || moveModalOpen || searchModalOpen || settingsModalOpen || deleteTarget || taskDeleteTarget ? null : undoNotice}
        onUndo={handleUndo}
        onDismiss={() => setUndoNotice(null)}
      />
    </div>
  );
}
