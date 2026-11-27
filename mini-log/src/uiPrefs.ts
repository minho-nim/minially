import { api } from '../../shared/client/api';

// 화면 설정(계정 기반): 원고 밑줄 끄기·첫 안내 다 봄. 어느 기기에서든 같다.
// 값은 로그인할 때 받는 내 정보(/api/me)에 함께 오고(따로 읽지 않음), 바꾸면 /api/prefs로 저장한다.
// 기기 저장(localStorage)은 값이 없을 때(오래된 서버 등)만 쓴다.
export interface UiPrefs { marks_off: boolean; steps_done: boolean }
let current: UiPrefs | null = null;
/** 로그인할 때마다 그 계정 값으로 바꾼다(다른 계정 값이 남지 않게) */
export function setUiPrefs(next: UiPrefs | null | undefined) { current = next ? { marks_off: !!next.marks_off, steps_done: !!next.steps_done } : null; }
export function uiPrefs(): UiPrefs | null { return current; }
export async function saveUiPrefs(next: Partial<UiPrefs>) {
  if (current) current = { ...current, ...next };
  await api('/api/prefs', { method: 'PUT', body: next });
}
