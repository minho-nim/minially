import { useEffect, useState } from 'react';
import { api } from '../../shared/client/api';

// 원고 편집의 '카테고리' 고르기: 블로그 구조에 적은 카테고리 중 하나에 이 원고(게시했으면 그 글)를 넣는다
interface Cat { id: string; name: string; parent_id: string | null }
interface Item { key: string; category_id: string | null; draft_id: string | null }

export function CategoryPick({ draftId, onMessage }: { draftId: string; onMessage: (m: { kind: 'error' | 'info'; text: string }) => void }) {
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ categories: Cat[]; items: Item[] }>('/api/structure').then(d => {
      if (!alive) return;
      setCats(d.categories);
      setItem(d.items.find(i => i.draft_id === draftId) ?? { key: `draft:${draftId}`, category_id: null, draft_id: draftId });
    }).catch(() => setCats([]));
    return () => { alive = false; };
  }, [draftId]);
  if (!cats?.length || !item) return null; // 카테고리를 아직 안 적었으면 숨김
  const tops = cats.filter(c => !c.parent_id);
  const name = (id: string | null) => { const c = cats.find(x => x.id === id); if (!c) return ''; const p = cats.find(x => x.id === c.parent_id); return p ? `${p.name} › ${c.name}` : c.name; };
  async function change(id: string) {
    const category_id = id || null;
    try { await api('/api/structure/place', { method: 'PUT', body: { items: [item!.key], category_id } }); setItem(i => i && { ...i, category_id }); onMessage({ kind: 'info', text: category_id ? `카테고리: ${name(category_id)}. 블로그 글쓰기에서도 이 카테고리를 골라 주세요.` : '카테고리를 뺐어요.' }); }
    catch (e) { onMessage({ kind: 'error', text: e instanceof Error ? e.message : '바꾸지 못했어요.' }); }
  }
  return (
    <div className="field" style={{ maxWidth: 280 }}>
      <label htmlFor="cat-pick">블로그 카테고리</label>
      <select id="cat-pick" className="input" value={item.category_id ?? ''} onChange={e => { void change(e.target.value); }}>
        <option value="">미분류</option>
        {tops.flatMap(t => [t, ...cats.filter(c => c.parent_id === t.id)]).map(c => <option key={c.id} value={c.id}>{c.parent_id ? `${name(c.parent_id)} › ${c.name}` : c.name}</option>)}
      </select>
    </div>
  );
}
