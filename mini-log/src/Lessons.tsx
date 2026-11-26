import { useEffect, useState } from 'react';
import { api } from '../../shared/client/api';
import { VERDICT_LABEL } from './Review';

// 지난 글에서 배운 점: '게시 7일 뒤 돌아보기'에 남긴 메모 중 최근 3개를 원고 쓰는 화면에 보여 준다(AI 안 씀).
interface Saved { draft_id: string; title: string; verdict: 'good' | 'ok' | 'low'; note: string }

export function Lessons({ draftId }: { draftId: string }) {
  const [items, setItems] = useState<Saved[]>([]);
  useEffect(() => {
    let alive = true;
    api<{ recent: Saved[] }>('/api/reviews').then(d => { if (alive) setItems(d.recent.filter(r => r.note && r.draft_id !== draftId).slice(0, 3)); }).catch(() => { /* 없어도 원고 쓰기에는 지장 없음 */ });
    return () => { alive = false; };
  }, [draftId]);
  if (!items.length) return null;
  return (
    <aside className="lessons" aria-label="지난 글에서 배운 점">
      <b className="small">지난 글에서 배운 점</b>
      <ul>
        {items.map(r => <li key={r.draft_id} className="small"><span className={`verdict v-${r.verdict}`}>{VERDICT_LABEL[r.verdict]}</span> {r.note} <span className="muted">— {r.title}</span></li>)}
      </ul>
    </aside>
  );
}
