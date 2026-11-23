import { AppData, Project, Task } from '../types';
import { INITIAL_DATA } from '../data/initialData';

const STORAGE_KEY = 'DAYFLOW_APP_DATA_V1';

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveAppData(INITIAL_DATA);
      return INITIAL_DATA;
    }
    const parsed = JSON.parse(raw) as Partial<AppData>;
    
    // Safe migration: ensure all arrays exist
    const schedules = (parsed.schedules || []).map((s) => ({
      ...s,
      // preserve user data while cleaning leading emoji clutter if any
      title: s.title ? s.title.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/u, '').trim() : ''
    }));

    const projects = (parsed.projects || []).map((p) => ({
      ...p,
      name: p.name ? p.name.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/u, '').trim() : ''
    }));

    const tasks = parsed.tasks || [];
    const presets = (parsed.presets || []).map((pr) => ({
      ...pr,
      name: pr.name ? pr.name.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/u, '').trim() : ''
    }));

    return {
      schedules,
      projects,
      tasks,
      presets,
      categories: parsed.categories || INITIAL_DATA.categories,
      recurrenceRules: parsed.recurrenceRules || [],
      recurrenceExceptions: parsed.recurrenceExceptions || [],
      settings: parsed.settings || INITIAL_DATA.settings,
    };
  } catch (err) {
    console.error('Failed to load data from localStorage', err);
    return INITIAL_DATA;
  }
}

export function saveAppData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save data to localStorage', err);
  }
}

export function resetAppData(): AppData {
  saveAppData(INITIAL_DATA);
  return INITIAL_DATA;
}

export function exportBackup(data: AppData): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  a.href = url;
  a.download = `DayFlow_Backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function calculateProjectProgress(projectId: string, tasks: Task[]): number {
  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  if (projectTasks.length === 0) return 0;
  const doneCount = projectTasks.filter((t) => t.status === 'done').length;
  return Math.round((doneCount / projectTasks.length) * 100);
}

export function syncProjectsProgress(projects: Project[], tasks: Task[]): Project[] {
  return projects.map((p) => {
    const progress = calculateProjectProgress(p.id, tasks);
    const status = progress === 100 ? 'done' : p.status === 'done' && progress < 100 ? 'active' : p.status;
    return {
      ...p,
      progress,
      status
    };
  });
}

// Add minutes to "HH:mm" and return "HH:mm"
export function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr || '0', 10);
  const m = parseInt(mStr || '0', 10);
  const totalM = h * 60 + m + minutes;
  const newH = Math.min(23, Math.floor(totalM / 60));
  const newM = totalM % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export function calculateDurationMinutes(start: string, end: string): number {
  const [h1, m1] = start.split(':').map((v) => parseInt(v, 10) || 0);
  const [h2, m2] = end.split(':').map((v) => parseInt(v, 10) || 0);
  const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  return diff > 0 ? diff : 30;
}
