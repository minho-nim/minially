export type ScheduleCategory = 'personal' | 'work' | 'project' | string;

export interface CategoryItem {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
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

export interface Schedule {
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

export interface PhrasePreset {
  id: string;
  type: PhraseType; // 'title' | 'memo'
  text: string;
  isFavorite: boolean;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  order?: number;

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
  id: string;
  timestamp: number;
  type: 'CREATE' | 'DELETE' | 'MOVE' | 'COPY' | 'UPDATE' | 'BATCH_CREATE' | 'TOGGLE_DONE';
  description: string;
  previousSchedules: Schedule[];
  newSchedules: Schedule[];
}

export interface AppSettings {
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
