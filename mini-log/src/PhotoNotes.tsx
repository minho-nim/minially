import { useState } from 'react';
import { api } from '../../shared/client/api';

// 사진마다 한 줄 메모: 사진만으로는 알 수 없는 사실(메뉴 이름·가격·느낌)을 사진 옆에 적는다.
// AI 초안은 이 메모를 그 사진 자리 근처 문단에 쓴다. 칸을 벗어나면(blur) 저장한다.
export interface NotePhoto { id: string; name: string; note?: string }

export function PhotoNotes({ photos, onSaved, onError }: { photos: NotePhoto[]; onSaved: (id: string, note: string) => void; onError: (text: string) => void }) {
  const [text, setText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const filled = photos.filter(p => (text[p.id] ?? p.note ?? '').trim()).length;

  async function save(photo: NotePhoto) {
    const next = (text[photo.id] ?? photo.note ?? '').trim();
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
