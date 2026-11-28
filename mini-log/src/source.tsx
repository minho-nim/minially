import { useSyncExternalStore } from 'react';

// 보는 계정(전체 · 네이버 · 구글): 메일·캘린더·블로그를 계정별로 거른다. 기본은 전체. 이 기기에 기억하고, 한 화면에서 바꾸면 다른 화면도 같이 바뀐다
export type Source = 'all' | 'naver' | 'google';
const KEY = 'minilog.source';
const listeners = new Set<() => void>();
const read = (): Source => { try { const v = localStorage.getItem(KEY); return v === 'naver' || v === 'google' ? v : 'all'; } catch { return 'all'; } };
let current: Source = read();
export function setSource(s: Source) {
  current = s;
  try { localStorage.setItem(KEY, s); } catch { /* 기억만 못 함 */ }
  listeners.forEach(l => l());
}
export function useSource(): Source {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => current, () => 'all');
}
export const SOURCE_LABEL: Record<Source, string> = { all: '전체', naver: '네이버', google: '구글' };
/** 메일 계정(naver·gmail)이 지금 보는 계정에 들어가는지 */
export const mailInSource = (account: string | undefined, s: Source) => s === 'all' || (s === 'naver' ? (account ?? 'naver') === 'naver' : account === 'gmail');

/** 보는 계정 고르기(작은 전환). 바꾸면 메일·캘린더·블로그가 함께 바뀐다 */
export function SourceSwitch({ note }: { note?: string }) {
  const s = useSource();
  return (
    <div className="source-switch" role="group" aria-label="보는 계정">
      {(['all', 'naver', 'google'] as Source[]).map(k => (
        <button key={k} type="button" aria-pressed={s === k} className={`src-${k}`} onClick={() => setSource(k)}>{SOURCE_LABEL[k]}</button>
      ))}
      {s !== 'all' && note && <span className="muted small">{note}</span>}
    </div>
  );
}
