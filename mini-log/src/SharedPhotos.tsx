// 휴대폰 '공유 → 미니로그'로 받은 사진: 서비스 워커가 이 기기 캐시(minilog-share)에 둔 사진을 꺼내
// 고른 원고(또는 새 원고)에 올리고 캐시에서 지운다. 사진은 올리기 전까지 서버로 가지 않는다.
import { useEffect, useState } from 'react';

const CACHE = 'minilog-share';
export interface DraftChoice { id: string; title: string; status: string }

/** 캐시에 둔 공유 사진을 File로 꺼낸다(못 읽으면 빈 목록) */
export async function takeSharedPhotos(): Promise<File[]> {
  if (!('caches' in window)) return [];
  try {
    const cache = await caches.open(CACHE);
    const keys = (await cache.keys()).filter(k => /shared-photo-\d+$/.test(k.url)).sort((a, b) => Number(a.url.split('-').pop()) - Number(b.url.split('-').pop()));
    const files: File[] = [];
    for (const key of keys) {
      const res = await cache.match(key);
      if (!res) continue;
      const blob = await res.blob();
      const name = decodeURIComponent(res.headers.get('x-file-name') ?? '') || `photo-${files.length + 1}.jpg`;
      files.push(new File([blob], name, { type: blob.type || 'image/jpeg' }));
    }
    return files;
  } catch { return []; }
}
export async function clearSharedPhotos() { try { await caches.delete(CACHE); } catch { /* 다음 공유 때 덮어씀 */ } }

export function SharedPhotos({ drafts, onUpload, onClose }: {
  drafts: DraftChoice[];
  /** draftId가 null이면 새 원고를 만들어 올린다. 다 올리면 그 원고를 연다 */
  onUpload: (draftId: string | null, files: File[], progress: (done: number) => void) => Promise<void>;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[] | null>(null);
  const [target, setTarget] = useState<string>('new');
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void takeSharedPhotos().then(setFiles); }, []);
  const open = drafts.filter(d => d.status !== 'published').slice(0, 20);
  async function go() {
    if (!files?.length) return;
    setError(''); setDone(0);
    try { await onUpload(target === 'new' ? null : target, files, setDone); await clearSharedPhotos(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : '사진을 올리지 못했어요.'); setDone(null); }
  }
  return <div className="card" role="dialog" aria-label="공유한 사진 넣기" style={{ display: 'grid', gap: 10 }}>
    <h2 style={{ margin: 0 }}>공유한 사진 {files ? `${files.length}장` : ''}</h2>
    {files === null && <p className="muted small" role="status">사진을 꺼내는 중…</p>}
    {files !== null && files.length === 0 && <>
      <p className="small">사진을 찾지 못했어요. 앱을 설치한 직후라면 한 번 더 공유해 주세요.</p>
      <div><button type="button" className="btn" onClick={() => { void clearSharedPhotos(); onClose(); }}>닫기</button></div>
    </>}
    {files !== null && files.length > 0 && <>
      <div className="field">
        <label htmlFor="share-target">어느 원고에 넣을까요?</label>
        <select id="share-target" className="input" value={target} onChange={e => setTarget(e.target.value)} disabled={done !== null}>
          <option value="new">새 원고 만들기</option>
          {open.map(d => <option key={d.id} value={d.id}>{d.title || '제목 없는 원고'}</option>)}
        </select>
      </div>
      <p className="muted small" style={{ margin: 0 }}>사진은 긴 변 1600px로 줄이고 위치·촬영 정보를 지운 뒤 올려요.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn primary" disabled={done !== null} onClick={() => { void go(); }}>{done !== null ? `올리는 중 ${done}/${files.length}` : `${files.length}장 넣기`}</button>
        <button type="button" className="btn ghost" disabled={done !== null} onClick={() => { void clearSharedPhotos(); onClose(); }}>넣지 않기</button>
      </div>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
  </div>;
}
