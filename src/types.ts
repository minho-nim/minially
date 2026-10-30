export type ScheduleCategory = 'personal' | 'work' | 'project' | string;

export interface CategoryItem {
  isUserManaged?: boolean;
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
  sortOrder?: number;
}

export type RecurrenceFrequency = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';
export type RecurrenceType = RecurrenceFrequency;

export interface RecurrenceRule {
  id: string;
  scheduleId: string;
  frequency: RecurrenceFrequency;
  interval?: number;
  weekdays?: number[];
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  count?: number;
}

export interface RecurrenceException {
  id: string;
  ruleId: string;
  originalDate: string; // YYYY-MM-DD
  action: 'cancelled' | 'modified';
  modifiedSchedule?: Partial<Schedule>;
}

export interface TitleBlock {
  id: string;
  text: string;
  presetId?: string;
}

export interface Schedule {
  isImportant?: boolean;
  sortOrder?: number;
  titleBlocks?: TitleBlock[];
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  category: ScheduleCategory;
  linkedProjectId?: string;
  presetId?: string;
  completed: boolean;
  memo?: string;
  recurrenceRuleId?: string;
  isRecurringInstance?: boolean;
}

export type ProjectStatus = 'planned' | 'active' | 'done';

export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: ProjectStatus;
  progress: number;
  color: string;
  taskIds: string[];
  memo: string;
}

export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  projectId?: string;
  title: string;
  startDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  status: TaskStatus;
  priority: TaskPriority;
  linkedScheduleId?: string;
  dependencyTaskIds?: string[];
  checklist?: ChecklistItem[];
  memo?: string;
}

export type PhraseType = 'title' | 'memo';

export interface PresetGroup {
  createdAt?: number;
  updatedAt?: number;
  id: string;
  name: string;
  sortOrder: number;
}

export interface PhrasePreset {
  groupId?: string;
  blocks?: TitleBlock[];
  id: string;
  type: PhraseType; // 'title' | 'memo'
  text: string;
  isFavorite: boolean;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  sortOrder: number;
  order?: number; // Legacy backup compatibility

  // Legacy backward-compatibility optional fields
  name?: string;
  icon?: string;
  color?: string;
  defaultTitle?: string;
  defaultCategory?: ScheduleCategory;
  defaultStartTime?: string;
  defaultDuration?: number;
  recurrence?: RecurrenceFrequency;
  checklistTemplates?: string[];
  memo?: string;
}

export type Preset = PhrasePreset;

export interface ChangeHistoryEntry {
  previousRules?: RecurrenceRule[];
  newRules?: RecurrenceRule[];
  previousExceptions?: RecurrenceException[];
  newExceptions?: RecurrenceException[];
  id: string;
  timestamp: number;
  type: 'CREATE' | 'DELETE' | 'MOVE' | 'COPY' | 'UPDATE' | 'BATCH_CREATE' | 'TOGGLE_DONE';
  description: string;
  previousTasks?: Task[];
  newTasks?: Task[];
  previousSchedules: Schedule[];
  newSchedules: Schedule[];
}

export interface AppSettings {
  presetGroups?: PresetGroup[];
  dayScheduleView?: 'category' | 'list';
  startDayOfWeek: 0 | 1; // 0: Sunday, 1: Monday
  defaultCategory: ScheduleCategory;
  defaultView: 'month' | 'week';
  showCompletedInCalendar: boolean;
  vibrateOnAction: boolean;
}

export interface AppData {
  schedules: Schedule[];
  presets: PhrasePreset[];
  categories: CategoryItem[];
  recurrenceRules: RecurrenceRule[];
  recurrenceExceptions: RecurrenceException[];
  tasks: Task[];
  projects?: Project[];
  settings: AppSettings;
}

export type ActiveNavTab = 'calendar' | 'tasks';
export type ActiveTab = 'calendar' | 'tasks' | 'projects';
