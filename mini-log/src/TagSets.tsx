import { useEffect, useState } from 'react';
import { api } from '../../shared/client/api';
import { showUndo } from './UndoToast';

// 해시태그 묶음: 저장해 둔 태그 모음을 눌러 지금 원고 태그에 더한다(겹치는 태그는 한 번만, 30개까지).
// 지금 원고의 태그를 이름 붙여 묶음으로 저장할 수도 있다. 같은 이름이면 태그를 바꾼다.
interface TagSet { id: string; name: string; tags: string[] }

export const mergeTags = (now: string[], add: string[]) => [...new Set([...now, ...add])].slice(0, 30);

export function TagSets({ tags, onApply }: { tags: string[]; onApply: (tags: string[]) => void }) {
  const [sets, setSets] = useState<TagSet[] | null>(null);
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  useEffect(() => { api<{ sets: TagSet[] }>('/api/tagsets').then(d => setSets(d.sets)).catch(() => setSets([])); }, []);

  const save = async () => {
    setMessage(null);
    try { const r = await api<{ sets: TagSet[] }>('/api/tagsets', { body: { name, tags } }); setSets(r.sets); setMessage({ kind: 'ok', text: `'${name.trim()}' 묶음으로 저장했어요.` }); setName(''); setOpen(false); }
    catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '저장하지 못했어요.' }); }
  };
  // 지우기: 바로 지우고 '되돌리기' 알림(원고에 넣은 태그는 그대로)
  const remove = async (set: TagSet) => {
    try {
      setSets((await api<{ sets: TagSet[] }>(`/api/tagsets/${set.id}`, { method: 'DELETE' })).sets);
      showUndo(`'${set.name.slice(0, 20)}' 묶음을 지웠어요`, async () => {
        await api(`/api/trash/${set.id}/restore`, { method: 'POST', body: {} });
        setSets((await api<{ sets: TagSet[] }>('/api/tagsets')).sets);
      });
    }
    catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '지우지 못했어요.' }); }
  };
  const apply = (set: TagSet) => {
    const next = mergeTags(tags, set.tags);
    onApply(next);
    setMessage({ kind: 'ok', text: `'${set.name}'에서 ${next.length - tags.length}개를 더했어요.` });
  };

  return (
    <div className="tag-sets">
      {sets && sets.length > 0 && (
        <ul className="tag-set-list" aria-label="저장한 태그 묶음">
          {sets.map(set => (
            <li key={set.id}>
              <button type="button" className="btn small" title={set.tags.map(t => `#${t}`).join(' ')} aria-label={`'${set.name}' 묶음 태그 ${set.tags.length}개 넣기`} onClick={() => apply(set)}>+ {set.name}<span className="muted"> {set.tags.length}</span></button>
              <button type="button" className="btn ghost small tag-set-x" aria-label={`'${set.name}' 묶음 지우기`} onClick={() => { void remove(set); }}>×</button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <div className="publish-row">
          <label className="sr-only" htmlFor="tagset-name">묶음 이름</label>
          <input id="tagset-name" className="input" maxLength={20} value={name} onChange={e => setName(e.target.value)} placeholder="묶음 이름(예: 성수 카페)" />
          <button type="button" className="btn primary small" disabled={!name.trim() || !tags.length} onClick={() => { void save(); }}>저장</button>
          <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>취소</button>
        </div>
      ) : (
        <button type="button" className="btn ghost small" disabled={!tags.length} onClick={() => setOpen(true)}>지금 태그를 묶음으로 저장</button>
      )}
      {message && <p className={message.kind === 'error' ? 'error small' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}
    </div>
  );
}
