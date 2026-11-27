import { api } from '../../shared/client/api';

// 화면 설정(계정 기반): 원고 밑줄 끄기·첫 안내 다 봄. 어느 기기에서든 같다.
// 기기 저장(localStorage)은 서버 응답 전 첫 화면을 빨리 그리는 데만 쓰고, 서버 값이 오면 따른다.
export interface UiPrefs { marks_off: boolean; steps_done: boolean }
let pending: Promise<UiPrefs> | null = null;
export function loadUiPrefs(): Promise<UiPrefs> {
  pending ??= api<UiPrefs>('/api/prefs').then(d => ({ marks_off: !!d.marks_off, steps_done: !!d.steps_done })).catch(e => { pending = null; throw e; });
  return pending;
}
export async function saveUiPrefs(next: Partial<UiPrefs>) {
  pending = null; // 다음에 읽을 때 새 값으로
  await api('/api/prefs', { method: 'PUT', body: next });
}
