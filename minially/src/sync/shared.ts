// 일정 공유: 내 공유 코드 만들기·끄기, 공유 받은 사람의 일정 불러오기(보기 전용).
import { useEffect, useMemo, useState } from 'react';
import type { CategoryItem, RecurrenceException, RecurrenceRule, Schedule, SharedView, Task } from '../types';
import { normalizeCode, syncEngine } from './syncEngine';

const BASE = import.meta.env.BASE_URL;
export const SHARED_PREFIX = 'shared~';
export const isSharedId = (id?: string | null) => !!id && id.startsWith(SHARED_PREFIX);
export const SHARED_COLORS = ['#7FA7C9', '#8DB596', '#C9A27F', '#A08FC9', '#C98FB7', '#7FBFB8'];

export interface SharedPayload {
  name: string;
  schedules: Schedule[];
  recurrenceRules: RecurrenceRule[];
  recurrenceExceptions: RecurrenceException[];
  categories: { id: string; name: string; color: string }[];
  tasks: Task[];
}

async function call(path: string, init: RequestInit, code: string) {
  let res: Response;
  try {
    res = await fetch(`${BASE}api/${path}`, { ...init, cache: 'no-store', headers: { ...(init.headers || {}), authorization: `Bearer ${code}` } });
  } catch { throw new Error('인터넷에 연결되어 있지 않습니다.'); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `서버 오류(${res.status})`);
  return body;
}

/** 내 공유 코드를 새로 만든다(이전 코드는 더 이상 못 씀). */
export async function rotateShareCode(): Promise<string> {
  const code = syncEngine.code;
  if (!code) throw new Error('로그인이 필요해요.');
  return (await call('share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'rotate' }) }, code)).code;
}

export async function disableShare() {
  const code = syncEngine.code;
  if (!code) throw new Error('로그인이 필요해요.');
  await call('share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'disable' }) }, code);
}

export async function fetchShared(code: string): Promise<SharedPayload> {
  const normalized = normalizeCode(code);
  if (normalized.length < 12) throw new Error('공유 코드를 다시 확인해 주세요.');
  return call('shared', { method: 'GET' }, normalized);
}

const cacheKey = (id: string) => `minially-shared-${id}`;
function readCache(id: string): SharedPayload | null {
  try { return JSON.parse(localStorage.getItem(cacheKey(id)) ?? 'null'); } catch { return null; }
}
function writeCache(id: string, data: SharedPayload) {
  try { localStorage.setItem(cacheKey(id), JSON.stringify(data)); } catch { /* 공간 부족: 화면에만 표시 */ }
}

export interface SharedOverlay {
  schedules: Schedule[];
  rules: RecurrenceRule[];
  exceptions: RecurrenceException[];
  categories: CategoryItem[];
  tasks: Task[];
  owners: Record<string, string>;
  errors: Record<string, string>;
}

/** 공유 받은 사람들의 일정을 불러와 내 화면에 겹칠 수 있게 id·카테고리를 바꿔 둔다. */
export function useSharedViews(views: SharedView[] | undefined): SharedOverlay {
  const list = views ?? [];
  const key = list.map(v => `${v.id}:${v.code}`).join('|');
  const [data, setData] = useState<Record<string, SharedPayload>>(() => Object.fromEntries(list.map(v => [v.id, readCache(v.id)]).filter(([, d]) => d)));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!list.length) return;
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      for (const view of list) {
        try {
          const payload = await fetchShared(view.code);
          if (!alive) return;
          writeCache(view.id, payload);
          setData(prev => ({ ...prev, [view.id]: payload }));
          setErrors(prev => { const next = { ...prev }; delete next[view.id]; return next; });
        } catch (error) {
          if (!alive) return;
          setErrors(prev => ({ ...prev, [view.id]: error instanceof Error ? error.message : '불러오지 못했어요.' }));
        }
      }
    };
    void load();
    const timer = setInterval(load, 30_000);
    const kick = () => { void load(); };
    window.addEventListener('focus', kick);
    document.addEventListener('visibilitychange', kick);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', kick); document.removeEventListener('visibilitychange', kick); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useMemo(() => {
    const out: SharedOverlay = { schedules: [], rules: [], exceptions: [], categories: [], tasks: [], owners: {}, errors };
    list.forEach((view, index) => {
      const payload = data[view.id];
      if (!payload || !view.visible) return;
      const p = `${SHARED_PREFIX}${view.id}~`;
      const catId = `${SHARED_PREFIX}${view.id}`;
      const label = view.label || payload.name || '공유 일정';
      out.owners[view.id] = label;
      out.categories.push({ id: catId, name: label, color: view.color, sortOrder: 1000 + index, isUserManaged: false });
      for (const s of payload.schedules) out.schedules.push({ ...s, id: p + s.id, category: catId, recurrenceRuleId: s.recurrenceRuleId ? p + s.recurrenceRuleId : undefined, presetId: undefined, linkedProjectId: undefined });
      for (const r of payload.recurrenceRules) out.rules.push({ ...r, id: p + r.id, scheduleId: p + r.scheduleId });
      for (const ex of payload.recurrenceExceptions) out.exceptions.push({ ...ex, id: p + ex.id, ruleId: p + ex.ruleId, modifiedSchedule: ex.modifiedSchedule ? { ...ex.modifiedSchedule, category: catId } : undefined });
      for (const t of payload.tasks) out.tasks.push({ ...t, id: p + t.id, title: `${label} · ${t.title}` });
    });
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, errors, key, list.map(v => `${v.label}${v.color}${v.visible}`).join()]);
}

/** 공유 받은 일정의 주인 이름 */
export function sharedOwner(id: string, owners: Record<string, string>) {
  const viewId = id.slice(SHARED_PREFIX.length).split('~')[0];
  return owners[viewId] ?? '공유 일정';
}
