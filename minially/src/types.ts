export type ScheduleCategory = 'personal' | 'work' | 'project' | string;

export interface CategoryItem {
  isUserManaged?: boolean;
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
  sortOrder?: number;
}

export type RecurrenceFrequency = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'custom';
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
  /** 매월·매년 반복에서 그 날짜가 없는 달(예: 31일, 2월 29일): 'last' 그 달 말일(기본), 'skip' 건너뛰기 */
  missingDay?: 'last' | 'skip';
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
  /** undefined: 공통 설정, null: 끄기, 숫자: 시작 전 분 */
  reminderMinutes?: number | null;
  sourceTaskId?: string;
  sourceNoteId?: string;
  sourceNoteExcerpt?: string;
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
  categoryId?: string;
  sourceNoteId?: string;
  sourceNoteExcerpt?: string;
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

/** 내 일정 공유(보기 전용 공유 코드). code는 내 기기끼리 보여 주려고 내 설정에 저장한다. */
export interface ShareSettings {
  code?: string;
  name: string;
  categoryIds: string[];
  includeTasks: boolean;
}

/** 공유 받은 사람(같이 보기). 내 PC·폰끼리 맞춰진다. */
export interface SharedView {
  id: string;
  code: string;
  label: string;
  color: string;
  visible: boolean;
}

/** 일정 알림(앱이 열려 있을 때). 기기마다 알림 권한은 따로 허용해야 한다. */
export interface ReminderSettings {
  enabled: boolean;
  minutesBefore: number;
}

export interface NoteDefaults {fontFamily:string;fontSize:number;lineHeight:number;color:string;highlight:string}

export interface AppSettings {
  /** 사진·글 일정에서 사람이 '원래대로'로 되돌린 제목 바꾸기(새 제목 낱말→예전 제목). 다음부터 자동으로 바꾸지 않는다. 계정 설정이라 기기끼리 맞춘다 */
  titleRejects?: string[];
  noteDefaults?: NoteDefaults;
  reminder?: ReminderSettings;
  share?: ShareSettings;
  sharedViews?: SharedView[];
  presetGroups?: PresetGroup[];
  dayScheduleView?: 'category' | 'list';
  startDayOfWeek: 0 | 1; // 0: Sunday, 1: Monday
  defaultCategory: ScheduleCategory;
  defaultView: 'month' | 'week';
  showCompletedInCalendar: boolean;
  vibrateOnAction: boolean;
}

export interface AppData {
  notes?: Note[];
  noteFolders?: NoteFolder[];
  notePhotos?: NotePhoto[];
  schedules: Schedule[];
  presets: PhrasePreset[];
  categories: CategoryItem[];
  recurrenceRules: RecurrenceRule[];
  recurrenceExceptions: RecurrenceException[];
  tasks: Task[];
  projects?: Project[];
  settings: AppSettings;
}

export interface NoteFolder {
  isUserManaged?: boolean;
  defaultCategoryId?: string;
  id: string;
  name: string;
  keywords: string[];
}

export interface NoteTextRun {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  highlight?: string;
  script?: 'super' | 'sub';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

export type NoteAlignment = 'left' | 'center' | 'right' | 'justify';
export interface NoteParagraph {
  type: 'paragraph';
  runs: NoteTextRun[];
  align?: NoteAlignment;
  list?: 'bullet' | 'number';
  indent?: number;
  lineHeight?: number;
}
export interface NoteTableCell { runs: NoteTextRun[]; align?: NoteAlignment }
export interface NoteTable { type: 'table'; rows: NoteTableCell[][] }
/** 메모 속 사진(실제 사진은 notePhotos 저장소에, 문서에는 번호만) */
export interface NoteImage { type: 'image'; photoId: string; width?: number; height?: number }
export type NoteBlock = NoteParagraph | NoteTable | NoteImage;
/** 메모 사진 한 장: 줄인 JPEG(data URL, 240KB 이하). 동기화된다. */
export interface NotePhoto { id: string; noteId: string; dataUrl: string; width: number; height: number; createdAt: number; updatedAt: number }

export interface Note {
  defaultStyle?: NoteDefaults;
  conflictOf?: string;
  conflictAt?: number;
  richDocument?: NoteBlock[];
  richBody?: NoteTextRun[];
  id: string;
  title: string;
  body: string;
  folderId: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export type ActiveNavTab = 'calendar' | 'tasks' | 'notes';
export type ActiveTab = 'calendar' | 'tasks' | 'projects';
