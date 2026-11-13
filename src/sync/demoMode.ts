// 체험 모드: 로그인 코드 없이 예시 데이터로 앱을 써 보는 모드.
// 기록은 이 기기(IndexedDB)에만 저장되고 서버와 맞추지 않는다(syncEngine에 코드가 없으므로 동기화 요청이 나가지 않음).
// 체험을 끝내면 이 기기의 체험 데이터를 모두 지우고 로그인 화면으로 돌아간다.
import { getDB } from '../db/indexedDB';
import type { CategoryItem, PhrasePreset, PresetGroup, Schedule, Task } from '../types';

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

/**
 * 오늘 날짜 기준으로 예시 데이터를 만든다. 지난달 1일 ~ 다음 달 말일(3개월)만 채운다.
 * 반복 일정은 프리셋을 눌러 넣은 것처럼 presetId·제목 블록을 함께 넣는다. 오늘 이전 일정은 완료로 둔다.
 */
export function demoData(today = new Date()) {
  const todayKey = ymd(today, 0);
  const categories: CategoryItem[] = [
    { id: 'demo-study', name: '공부', color: '#CF8FA8', sortOrder: 0, isUserManaged: true },
    { id: 'demo-exercise', name: '운동', color: '#8FB8CF', sortOrder: 1, isUserManaged: true },
    { id: 'demo-meet', name: '약속', color: '#E3B07C', sortOrder: 2, isUserManaged: true },
  ];
  const now = Date.now();
  const presetGroups: PresetGroup[] = [
    { id: 'demo-g-study', name: '공부', sortOrder: 0, createdAt: now, updatedAt: now },
    { id: 'demo-g-exercise', name: '운동', sortOrder: 1, createdAt: now, updatedAt: now },
    { id: 'demo-g-meet', name: '약속', sortOrder: 2, createdAt: now, updatedAt: now },
  ];
  // [프리셋 id, 문구, 그룹, 카테고리]
  const presetDefs = [
    ['demo-p-english', '영어 학원', 'demo-g-study', 'demo-study'],
    ['demo-p-math', '수학 학원', 'demo-g-study', 'demo-study'],
    ['demo-p-library', '도서관', 'demo-g-study', 'demo-study'],
    ['demo-p-swim', '수영', 'demo-g-exercise', 'demo-exercise'],
    ['demo-p-walk', '저녁 산책', 'demo-g-exercise', 'demo-exercise'],
    ['demo-p-club', '동아리', 'demo-g-meet', 'demo-meet'],
    ['demo-p-book', '독서 모임', 'demo-g-meet', 'demo-meet'],
  ] as const;
  const usage = new Map<string, number>();

  const schedules: Schedule[] = [];
  const add = (date: string, title: string, category: string, extra: Partial<Schedule> = {}) => {
    schedules.push({ id: `demo-s${schedules.length + 1}`, date, title, category, completed: date < todayKey, ...extra });
  };
  const fromPreset = (date: string, presetId: string, extra: Partial<Schedule> = {}) => {
    const def = presetDefs.find(d => d[0] === presetId)!;
    usage.set(presetId, (usage.get(presetId) ?? 0) + 1);
    add(date, def[1], def[3], { presetId, titleBlocks: [{ id: `demo-b${schedules.length + 1}`, text: def[1], presetId }], ...extra });
  };

  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  for (let d = new Date(first), week = 0; d <= last; d.setDate(d.getDate() + 1)) {
    const date = ymd(d, 0), day = d.getDay();
    if (day === 0) week++;
    if (day === 1 || day === 3 || day === 5) fromPreset(date, 'demo-p-swim', { startTime: '07:00', endTime: '08:00' });
    if (day === 2 || day === 4) fromPreset(date, 'demo-p-english', { startTime: '18:00', endTime: '19:30' });
    if (day === 3) fromPreset(date, 'demo-p-math', { startTime: '19:00', endTime: '21:00' });
    if (day === 5 && week % 2 === 0) fromPreset(date, 'demo-p-club', { startTime: '15:30' });
    if (day === 6 && week % 2 === 1) fromPreset(date, 'demo-p-library', { startTime: '14:00' });
    if (day === 6 && d.getDate() >= 15 && d.getDate() <= 21) fromPreset(date, 'demo-p-book', { startTime: '16:00' });
  }
  // 오늘과 가까운 날의 한 번뿐인 일정
  fromPreset(todayKey, 'demo-p-walk');
  add(todayKey, '영어 단어 30개', 'demo-study', { isImportant: true });
  add(ymd(today, 1), '친구 생일', 'demo-meet', { isImportant: true });
  add(ymd(today, 3), '과학 수행평가', 'demo-study', { isImportant: true });
  add(ymd(today, 11), '모의고사', 'demo-study', { isImportant: true });
  add(ymd(today, 14), '가족 저녁', 'demo-meet', { startTime: '18:00' });
  add(ymd(today, -9), '치과', 'demo-meet', { startTime: '16:30' });

  const t = (n: number, offset: number, title: string, priority: Task['priority'], status: Task['status'] = 'todo'): Task =>
    ({ id: `demo-t${n}`, title, startDate: ymd(today, offset), dueDate: ymd(today, offset), status, priority });
  const tasks: Task[] = [
    t(1, 0, '수행평가 자료 찾기', 'high'), t(2, 0, '독후감 초안 쓰기', 'medium'), t(3, 0, '문제집 3단원 풀기', 'medium'),
    t(4, 0, '운동화 빨기', 'low', 'done'), t(5, -1, '영어 숙제', 'medium', 'done'), t(6, 1, '생일 선물 포장', 'medium'),
  ];
  const presets: PhrasePreset[] = presetDefs.map(([id, text, groupId], i) => ({
    id, type: 'title', text, groupId, isFavorite: i < 2, usageCount: usage.get(id) ?? 0, createdAt: now, updatedAt: now, sortOrder: i,
  }));
  return { categories, schedules, tasks, presets, presetGroups };
}

/** 체험 시작: 이 기기 데이터를 비우고 예시 데이터를 넣은 뒤 새로고침 */
export async function startDemo() {
  await clearLocal();
  const { categories, schedules, tasks, presets, presetGroups } = demoData();
  const db = await getDB();
  const tx = db.transaction(['categories', 'schedules', 'tasks', 'presets', 'appSettings'], 'readwrite');
  await tx.objectStore('appSettings').put({ id: 'global_settings', presetGroups } as never);
  for (const c of categories) await tx.objectStore('categories').put(c);
  for (const x of schedules) await tx.objectStore('schedules').put(x);
  for (const x of tasks) await tx.objectStore('tasks').put(x);
  for (const x of presets) await tx.objectStore('presets').put(x);
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
  window.location.replace('/');
}

export const DEMO_PATH = '/demo';

/**
 * 체험 주소(/demo)로 들어오면 체험을 시작한다. 체험은 이 주소로만 시작할 수 있다.
 * 이미 코드로 로그인한 기기라면 그 기기 데이터를 지우면 안 되므로 체험을 시작하지 않고 앱 첫 화면으로 보낸다.
 * 체험을 시작하면 새로고침되므로 true(화면을 그리지 말 것)를 돌려준다.
 */
export async function enterDemoFromPath(loggedIn: boolean): Promise<boolean> {
  if (!window.location.pathname.replace(/\/+$/, '').endsWith(DEMO_PATH)) return false;
  if (loggedIn) { window.history.replaceState(null, '', '/'); return false; }
  if (isDemo()) return false;
  await startDemo();
  return true;
}
