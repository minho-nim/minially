// 체험 모드: 로그인 코드 없이 예시 데이터로 앱을 써 보는 모드.
// 기록은 이 기기(IndexedDB)에만 저장되고 서버와 맞추지 않는다(syncEngine에 코드가 없으므로 동기화 요청이 나가지 않음).
// 체험을 끝내면 이 기기의 체험 데이터를 모두 지우고 로그인 화면으로 돌아간다.
import { getDB } from '../db/indexedDB';
import type { CategoryItem, Schedule, Task } from '../types';

const DEMO_KEY = 'minially-demo';
const CLEAR_STORES = ['schedules', 'presets', 'categories', 'recurrenceRules', 'recurrenceExceptions', 'tasks', 'appSettings', 'changeHistory'] as const;

export function isDemo() {
  try { return localStorage.getItem(DEMO_KEY) === '1'; } catch { return false; }
}

async function clearLocal() {
  const db = await getDB();
  const tx = db.transaction([...CLEAR_STORES], 'readwrite');
  for (const store of CLEAR_STORES) await tx.objectStore(store).clear();
  await tx.done;
}

function ymd(base: Date, offset: number) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 오늘 날짜 기준으로 예시 데이터를 만든다(언제 열어도 이번 주 근처에 일정이 보이게). */
export function demoData(today = new Date()) {
  const categories: CategoryItem[] = [
    { id: 'demo-study', name: '공부', color: '#CF8FA8', sortOrder: 0, isUserManaged: true },
    { id: 'demo-exercise', name: '운동', color: '#8FB8CF', sortOrder: 1, isUserManaged: true },
    { id: 'demo-meet', name: '약속', color: '#E3B07C', sortOrder: 2, isUserManaged: true },
  ];
  const s = (n: number, offset: number, title: string, category: string, extra: Partial<Schedule> = {}): Schedule =>
    ({ id: `demo-s${n}`, date: ymd(today, offset), title, category, completed: false, ...extra });
  const schedules: Schedule[] = [
    s(1, 0, '영어 학원', 'demo-study', { startTime: '17:00', endTime: '18:00', completed: true }),
    s(2, 0, '수학 학원', 'demo-study', { startTime: '19:00', endTime: '21:00' }),
    s(3, 0, '영어 단어 30개', 'demo-study', { isImportant: true }),
    s(4, 0, '저녁 산책', 'demo-exercise'),
    s(5, -2, '도서관', 'demo-study', { startTime: '14:00' }),
    s(6, -1, '수영', 'demo-exercise', { startTime: '07:00' }),
    s(7, 1, '친구 생일', 'demo-meet', { isImportant: true }),
    s(8, 3, '과학 수행평가', 'demo-study', { isImportant: true }),
    s(9, 5, '수영', 'demo-exercise', { startTime: '07:00' }),
    s(10, 6, '독서 모임', 'demo-meet', { startTime: '16:00' }),
    s(11, 8, '영어 학원', 'demo-study', { startTime: '18:00' }),
    s(12, -6, '영어 학원', 'demo-study', { startTime: '18:00' }),
  ];
  const t = (n: number, title: string, priority: Task['priority'], status: Task['status'] = 'todo'): Task =>
    ({ id: `demo-t${n}`, title, startDate: ymd(today, 0), dueDate: ymd(today, 0), status, priority });
  const tasks: Task[] = [t(1, '수행평가 자료 찾기', 'high'), t(2, '독후감 초안 쓰기', 'medium'), t(3, '문제집 3단원 풀기', 'medium'), t(4, '운동화 빨기', 'low', 'done')];
  const now = Date.now();
  const presets = ['영어 학원', '수학 학원', '도서관', '수영', '단어 30개', '독서 모임'].map((text, i) => ({
    id: `demo-p${i + 1}`, type: 'title' as const, text, isFavorite: i < 2, usageCount: 6 - i, createdAt: now, updatedAt: now, sortOrder: i,
  }));
  return { categories, schedules, tasks, presets };
}

/** 체험 시작: 이 기기 데이터를 비우고 예시 데이터를 넣은 뒤 새로고침 */
export async function startDemo() {
  await clearLocal();
  const { categories, schedules, tasks, presets } = demoData();
  const db = await getDB();
  const tx = db.transaction(['categories', 'schedules', 'tasks', 'presets'], 'readwrite');
  for (const c of categories) await tx.objectStore('categories').put(c);
  for (const x of schedules) await tx.objectStore('schedules').put(x);
  for (const x of tasks) await tx.objectStore('tasks').put(x);
  for (const x of presets) await tx.objectStore('presets').put(x as never);
  await tx.done;
  try {
    localStorage.setItem(DEMO_KEY, '1');
    localStorage.setItem('minially-default-categories-cleared', '1');
  } catch { /* 저장 공간이 막힌 브라우저: 이번 실행 동안만 체험 */ }
  window.location.reload();
}

/** 체험 끝내기: 체험 데이터를 지우고 로그인 화면으로 */
export async function endDemo() {
  await clearLocal();
  try { localStorage.removeItem(DEMO_KEY); } catch { /* 무시 */ }
  window.location.reload();
}
