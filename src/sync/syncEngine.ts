// 기기 동기화: 이 기기 IndexedDB ↔ 서버(/api/sync).
// 마지막으로 서버와 맞춘 각 항목의 지문(shadow)을 기억해 두고, 달라진 항목만 올린다.
// 서버에서 받은 항목은 그사이 이 기기에서 또 바뀌지 않았을 때만 덮어쓴다(바뀌었으면 다음 번에 올라감).
import { getDB, DEFAULT_CATEGORIES } from '../db/indexedDB';

const STORES = ['schedules', 'presets', 'categories', 'recurrenceRules', 'recurrenceExceptions', 'tasks', 'appSettings'] as const;
type SyncStore = (typeof STORES)[number];
const CONTENT_STORES: SyncStore[] = ['schedules', 'presets', 'categories', 'recurrenceRules', 'recurrenceExceptions', 'tasks'];
const STATE_KEY = 'minially-sync-v1';
const API = `${import.meta.env.BASE_URL}api/sync`;

interface SyncState { code: string; lastSeq: number; shadow: Record<string, string>; lastSyncedAt?: number }
interface RemoteRecord { store: SyncStore; id: string; data: unknown }
interface Change { store: SyncStore; id: string; data: unknown }

export type SyncStatus =
  | { kind: 'off' }
  | { kind: 'idle'; lastSyncedAt?: number }
  | { kind: 'syncing' }
  | { kind: 'offline'; lastSyncedAt?: number }
  | { kind: 'error'; message: string; lastSyncedAt?: number };

export class SyncError extends Error {
  constructor(message: string, readonly status = 0) { super(message); }
}

const key = (store: string, id: string) => `${store}/${id}`;

function fingerprint(value: unknown) {
  const text = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${text.length.toString(36)}.${(h >>> 0).toString(36)}`;
}

export function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

function loadState(): SyncState | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null');
    return parsed && typeof parsed.code === 'string' ? parsed : null;
  } catch { return null; }
}
function saveState(state: SyncState | null) {
  try {
    if (state) localStorage.setItem(STATE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STATE_KEY);
  } catch { /* 저장 공간이 막힌 브라우저: 이번 실행 동안만 유지 */ }
}

async function readLocal() {
  const db = await getDB();
  const map = new Map<string, { store: SyncStore; id: string; value: unknown }>();
  for (const store of STORES) {
    const items = await db.getAll(store);
    for (const item of items as { id: string }[]) map.set(key(store, item.id), { store, id: item.id, value: item });
  }
  return map;
}

async function request(code: string, method: 'GET' | 'POST', since: number, changes?: Change[]) {
  let response: Response;
  try {
    response = await fetch(`${API}?since=${since}`, {
      method,
      headers: { authorization: `Bearer ${code}`, ...(changes ? { 'content-type': 'application/json' } : {}) },
      body: changes ? JSON.stringify({ since, changes }) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new SyncError('인터넷에 연결되어 있지 않습니다.', 0);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new SyncError(body?.error ?? `서버 오류(${response.status})`, response.status);
  return body as { seq: number; records: RemoteRecord[] };
}

/** 받은 항목을 이 기기에 반영. expected에 있는 키는 지금 값이 그 지문과 같을 때만 덮어쓴다. */
async function applyRemote(records: RemoteRecord[], state: SyncState, expected?: Map<string, string | null>) {
  if (!records.length) return false;
  const db = await getDB();
  const tx = db.transaction([...STORES], 'readwrite');
  let changed = false;
  for (const r of records) {
    if (!(STORES as readonly string[]).includes(r.store)) continue;
    const k = key(r.store, r.id);
    const os = tx.objectStore(r.store);
    const current = await os.get(r.id);
    const currentPrint = current === undefined ? null : fingerprint(current);
    // 그사이 이 기기에서 바뀐 항목은 덮어쓰지 않는다(다음 번에 이 기기 값이 올라감).
    if (expected) {
      const want = expected.has(k) ? expected.get(k) : (state.shadow[k] ?? null);
      if (want !== currentPrint) continue;
    }
    if (r.data === null) {
      if (current !== undefined) { await os.delete(r.id); changed = true; }
      delete state.shadow[k];
    } else {
      const remotePrint = fingerprint(r.data);
      if (currentPrint !== remotePrint) { await os.put(r.data as never); changed = true; }
      state.shadow[k] = remotePrint;
    }
  }
  await tx.done;
  return changed;
}

type Listener = (status: SyncStatus) => void;

class SyncEngine {
  private state = loadState();
  private status: SyncStatus = this.state ? { kind: 'idle', lastSyncedAt: this.state.lastSyncedAt } : { kind: 'off' };
  private listeners = new Set<Listener>();
  private running: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private onRemoteChange: () => void | Promise<void> = () => {};

  get connected() { return !!this.state; }
  /** 내 코드(서버 요청용). 로그인 전이면 null */
  get code() { return this.state?.code ?? null; }
  getStatus() { return this.status; }
  subscribe(listener: Listener) { this.listeners.add(listener); listener(this.status); return () => { this.listeners.delete(listener); }; }
  setRemoteChangeHandler(handler: () => void | Promise<void>) { this.onRemoteChange = handler; }

  private setStatus(status: SyncStatus) { this.status = status; for (const l of this.listeners) l(status); }

  /** 로컬 변경 뒤 호출: 잠깐 모아서 한 번에 동기화 */
  schedule(delay = 1200) {
    if (!this.state) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.syncNow(); }, delay);
  }

  syncNow(): Promise<void> {
    if (!this.state) return Promise.resolve();
    if (this.running) { this.again = true; return this.running; }
    this.running = (async () => {
      try {
        do { this.again = false; await this.runOnce(); } while (this.again && this.state);
      } finally { this.running = null; }
    })();
    return this.running;
  }

  private async runOnce() {
    const state = this.state;
    if (!state) return;
    this.setStatus({ kind: 'syncing' });
    try {
      const local = await readLocal();
      const changes: Change[] = [];
      const expected = new Map<string, string | null>();
      for (const [k, item] of local) {
        const print = fingerprint(item.value);
        if (state.shadow[k] !== print) { changes.push({ store: item.store, id: item.id, data: item.value }); expected.set(k, print); }
      }
      for (const k of Object.keys(state.shadow)) {
        if (local.has(k)) continue;
        const [store, ...rest] = k.split('/');
        changes.push({ store: store as SyncStore, id: rest.join('/'), data: null });
        expected.set(k, null);
      }
      const result = changes.length
        ? await request(state.code, 'POST', state.lastSeq, changes)
        : await request(state.code, 'GET', state.lastSeq);
      if (this.state !== state) return; // 그사이 연결 해제
      // 올린 항목은 서버 값 = 올린 값이므로 지문을 맞춰 둔다(서버가 돌려준 목록에도 들어 있음).
      for (const c of changes) {
        const k = key(c.store, c.id);
        if (c.data === null) delete state.shadow[k]; else state.shadow[k] = expected.get(k)!;
      }
      const changed = await applyRemote(result.records, state, expected);
      state.lastSeq = Math.max(state.lastSeq, result.seq);
      state.lastSyncedAt = Date.now();
      saveState(state);
      this.setStatus({ kind: 'idle', lastSyncedAt: state.lastSyncedAt });
      if (changed) await this.onRemoteChange();
    } catch (error) {
      if (this.state !== state) return;
      if (error instanceof SyncError && error.status === 0) this.setStatus({ kind: 'offline', lastSyncedAt: state.lastSyncedAt });
      else this.setStatus({ kind: 'error', message: error instanceof Error ? error.message : '동기화하지 못했습니다.', lastSyncedAt: state.lastSyncedAt });
    }
  }

  /** 코드 확인 후 서버 데이터 상황을 알려 준다(연결 전 단계). */
  async inspect(rawCode: string) {
    const code = normalizeCode(rawCode);
    if (code.length < 12) throw new SyncError('코드를 다시 확인해 주세요.', 401);
    const remote = await request(code, 'GET', 0);
    const serverHasData = remote.records.some(r => r.data !== null && r.store !== 'appSettings');
    const local = await readLocal();
    // 새 기기가 처음 실행될 때 자동으로 만드는 기본 카테고리는 '이 기기 데이터'로 세지 않는다.
    const defaults = new Map(DEFAULT_CATEGORIES.map(cat => [cat.id, cat]));
    const isUntouchedDefault = (item: { store: SyncStore; id: string; value: unknown }) => {
      const base = defaults.get(item.id);
      const cat = item.value as { name?: string; color?: string };
      return item.store === 'categories' && !!base && cat.name === base.name && cat.color === base.color;
    };
    const localHasData = [...local.values()].some(item => CONTENT_STORES.includes(item.store) && !isUntouchedDefault(item));
    return { code, remote, serverHasData, localHasData };
  }

  /**
   * 연결. mode
   * - 'merge': 이 기기 데이터를 서버에 올리고 서버 데이터와 합친다(같은 항목은 이 기기 값이 이김).
   * - 'server': 이 기기 데이터를 지우고 서버 데이터로 바꾼다.
   */
  async connect(rawCode: string, mode: 'merge' | 'server') {
    const { code, remote } = await this.inspect(rawCode);
    const state: SyncState = { code, lastSeq: 0, shadow: {} };
    if (mode === 'server') {
      const db = await getDB();
      const tx = db.transaction([...STORES], 'readwrite');
      for (const store of STORES) await tx.objectStore(store).clear();
      await tx.done;
      await applyRemote(remote.records.filter(r => r.data !== null), state);
      state.lastSeq = remote.seq;
    }
    this.state = state;
    saveState(state);
    await this.syncNow();
    await this.onRemoteChange();
    if (this.status.kind === 'error') throw new SyncError(this.status.message);
  }

  /** 연결 해제: 이 기기 데이터는 그대로 두고 더 이상 서버와 맞추지 않는다. */
  disconnect() {
    clearTimeout(this.timer);
    this.state = null;
    saveState(null);
    this.setStatus({ kind: 'off' });
  }

  /**
   * 로그아웃: 먼저 서버와 맞춘 뒤 이 기기의 데이터를 지우고 연결을 끊는다(서버 데이터는 남음).
   * 맞추지 못하면(오프라인 등) 이 기기에만 있는 변경이 사라질 수 있어 force 없이는 멈춘다.
   */
  async logout(force = false) {
    if (!this.state) return;
    await this.syncNow();
    if (!force && (this.status.kind === 'error' || this.status.kind === 'offline')) {
      throw new SyncError('서버와 맞추지 못했어요. 인터넷 연결을 확인해 주세요.');
    }
    const db = await getDB();
    const all = [...STORES, 'changeHistory'] as const;
    const tx = db.transaction([...all], 'readwrite');
    for (const store of all) await tx.objectStore(store).clear();
    await tx.done;
    this.disconnect();
  }

  /** 앱 시작 시: 화면에 돌아오거나 인터넷이 다시 연결되면 동기화 */
  start() {
    const kick = () => { if (document.visibilityState === 'visible') void this.syncNow(); };
    window.addEventListener('online', kick);
    document.addEventListener('visibilitychange', kick);
    window.addEventListener('focus', kick);
    setInterval(kick, 30_000); // 화면을 보고 있는 동안 30초마다 확인
    kick();
  }
}

export const syncEngine = new SyncEngine();
