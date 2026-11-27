import { useState } from 'react';
import { api } from '../../shared/client/api';

// 사진마다 한 줄 메모: 사진만으로는 알 수 없는 사실(메뉴 이름·가격·느낌)을 사진 옆에 적는다.
// AI 초안은 이 메모를 그 사진 자리 근처 문단에 쓴다. 칸을 벗어나면(blur) 저장한다.
export interface NotePhoto { id: string; name: string; note?: string }

// 'AI로 사진 설명 후보': 메모가 빈 사진에 무엇이 찍혔는지 한 줄 후보를 받는다. 후보는 저장하지 않고, 사람이 '넣기'를 눌러야 메모가 된다.
export function PhotoNotes({ photos, onSaved, onError, draftId, canAi = false }: { photos: NotePhoto[]; onSaved: (id: string, note: string) => void; onError: (text: string) => void; draftId?: string; canAi?: boolean }) {
  const [text, setText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [hints, setHints] = useState<Record<string, string>>({});
  const [hinting, setHinting] = useState(false);
  const filled = photos.filter(p => (text[p.id] ?? p.note ?? '').trim()).length;
  const empty = photos.slice(0, 8).filter(p => !(text[p.id] ?? p.note ?? '').trim()).length;

  async function suggest() {
    if (!draftId) return;
    setHinting(true);
    try {
      const { notes } = await api<{ notes: { photo_id: string; note: string }[] }>(`/api/drafts/${draftId}/photo-notes`, { body: {} });
      setHints(Object.fromEntries(notes.map(n => [n.photo_id, n.note])));
      if (!notes.length) onError('AI가 사진 설명 후보를 찾지 못했어요. 직접 적어 주세요.');
    } catch (e) { onError(e instanceof Error ? e.message : '사진 설명 후보를 받지 못했어요.'); }
    finally { setHinting(false); }
  }
  async function accept(photo: NotePhoto, note: string) {
    setText(t => ({ ...t, [photo.id]: note }));
    setHints(h => { const n = { ...h }; delete n[photo.id]; return n; });
    await save(photo, note);
  }

  async function save(photo: NotePhoto, value?: string) {
    const next = (value ?? text[photo.id] ?? photo.note ?? '').trim();
    if (next === (photo.note ?? '').trim()) return;
    setSaving(photo.id);
    try {
      const { note } = await api<{ note: string }>(`/api/photos/${photo.id}`, { method: 'PATCH', body: { note: next } });
      onSaved(photo.id, note);
    } catch {
      onError('사진 메모를 저장하지 못했어요. 다시 적어 주세요.');
    } finally {
      setSaving(null);
    }
  }

  if (photos.length === 0) return null;
  return (
    <details className="photo-notes" open={filled > 0 || photos.length <= 6}>
      <summary>사진마다 한 줄 메모 <span className="muted small">{filled}/{photos.length}장 · 선택</span></summary>
      <p className="muted small" style={{ margin: '4px 0 8px' }}>사진만 보고는 알 수 없는 것(메뉴 이름·가격·맛·느낌)을 적으면 AI가 그 사진 근처에 써요. 적지 않은 건 지어내지 않아요.</p>
      {draftId && canAi && empty > 0 && (
        <div className="ai-row" style={{ marginBottom: 8 }}>
          <button type="button" className="btn small ghost" onClick={() => { void suggest(); }} disabled={hinting}>{hinting ? '사진 보는 중…' : 'AI로 사진 설명 후보'}</button>
          {Object.keys(hints).length > 1 && <button type="button" className="btn small" onClick={() => { for (const p of photos) if (hints[p.id]) void accept(p, hints[p.id]); }}>후보 모두 넣기</button>}
          <span className="muted small">찍힌 것만 적어요. 맞는지 보고 넣어 주세요.</span>
        </div>
      )}
      <ol className="note-list">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <img src={`/api/photos/${photo.id}`} alt="" loading="lazy" />
            <label className="sr-only" htmlFor={`note-${photo.id}`}>사진 {index + 1} 메모</label>
            <span className="note-n" aria-hidden="true">{index + 1}</span>
            <input
              id={`note-${photo.id}`} className="input" maxLength={300} placeholder={`사진 ${index + 1}: 예) 소금빵 3,500원, 겉바속촉`}
              value={text[photo.id] ?? photo.note ?? ''}
              onChange={e => setText(t => ({ ...t, [photo.id]: e.target.value }))}
              onBlur={() => { void save(photo); }}
              aria-busy={saving === photo.id}
            />
            {hints[photo.id] && (
              <span className="note-hint small">후보: {hints[photo.id]}
                <button type="button" className="btn small" onClick={() => { void accept(photo, hints[photo.id]); }} aria-label={`사진 ${index + 1} 후보 넣기`}>넣기</button>
              </span>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

/** 경험 칸의 '항목: ' 뼈대 중 아직 비어 있는 항목 이름 */
export function emptyOutline(experience: string) {
  return experience.split('\n').map(l => l.match(/^([^:\n]{2,30}):\s*$/)?.[1]?.trim()).filter((x): x is string => !!x);
}
