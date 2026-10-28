export type ScheduleCategory = 'personal' | 'work' | 'project';

export interface Schedule {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (e.g. "09:00")
  endTime: string; // HH:mm (e.g. "10:30")
  category: ScheduleCategory;
  linkedProjectId?: string;
  presetId?: string;
  completed: boolean;
  memo: string;
}

export type ProjectStatus = 'planned' | 'active' | 'done';

export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: ProjectStatus;
  progress: number; // 0 - 100
  color: string; // Hex or cute color
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
  projectId: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: TaskStatus;
  priority: TaskPriority;
  linkedScheduleId?: string;
  dependencyTaskIds: string[];
  checklist: ChecklistItem[];
  memo: string;
}

export type RecurrenceType = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface Preset {
  id: string;
  name: string;
  icon: string; // emoji e.g. 🎀, 👑, 🍓, ☕, 💼, 🌸
  color: string;
  defaultTitle: string;
  defaultCategory: ScheduleCategory;
  defaultStartTime: string;
  defaultDuration: number; // minutes, e.g. 30, 60, 90
  recurrence: RecurrenceType;
  checklistTemplates: string[];
  linkedProjectTemplate?: string;
  memo: string;
  isFavorite?: boolean;
}

export interface AppData {
  schedules: Schedule[];
  projects: Project[];
  tasks: Task[];
  presets: Preset[];
}

export type ActiveTab = 'home' | 'calendar' | 'projects' | 'presets' | 'mypage';
