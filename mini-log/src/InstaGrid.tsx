import { useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/client/api';
import type { CalendarDraft } from './Calendar';

// 인스타 격자 미리보기: 게시 예정 원고가 다 올라갔을 때 프로필 격자(3열, 4:5)가 어떻게 보일지 미리 본다.
// 칸 두 개를 차례로 누르면 두 원고의 게시일을 맞바꾼다(게시 예정 원고끼리만). 사진은 원고의 첫 사진.
export interface GridTile { id: string; title: string; kind: 'planned' | 'published'; date: string }

const kstDate = (ms: number) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);

/** 격자 순서: 앞으로 올릴 원고(늦은 날짜가 왼쪽 위) → 이미 올린 원고(최근 것부터), 최대 size칸 */
export function gridTiles(drafts: CalendarDraft[], today: string, size = 12): GridTile[] {
  const planned = drafts.filter(d => d.status !== 'published' && d.planned_on && d.planned_on >= today)
    .sort((a, b) => b.planned_on!.localeCompare(a.planned_on!) || a.id.localeCompare(b.id))
    .map(d => ({ id: d.id, title: d.title.trim() || '제목 없는 원고', kind: 'planned' as const, date: d.planned_on! }));
  const published = drafts.filter(d => d.status === 'published' && d.published_at)
    .sort((a, b) => b.published_at! - a.published_at!)
    .map(d => ({ id: d.id, title: d.title.trim() || '제목 없는 원고', kind: 'published' as const, date: kstDate(d.published_at!) }));
  return [...planned, ...published].slice(0, size);
}

const short = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;

export function InstaGrid<D extends CalendarDraft>({ drafts, today, onSaved }: { drafts: D[]; today: string; onSaved: (drafts: D[]) => void }) {
  const tiles = useMemo(() => gridTiles(drafts, today), [drafts, today]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const ids = tiles.map(t => t.id).join(',');

  useEffect(() => {
    if (!ids) return;
    let alive = true;
    api<{ covers: Record<string, string> }>(`/api/photos/covers?ids=${ids}`)
      .then(d => { if (alive) setCovers(d.covers); })
      .catch(() => { if (alive) setCovers({}); }); // 사진이 없어도 제목 칸으로 보인다
    return () => { alive = false; };
  }, [ids]);

  const swap = async (a: GridTile, b: GridTile) => {
    setBusy(true); setMessage(null);
    try {
      const [first, second] = await Promise.all([
        api<{ draft: D }>(`/api/drafts/${a.id}`, { method: 'PUT', body: { planned_on: b.date } }),
        api<{ draft: D }>(`/api/drafts/${b.id}`, { method: 'PUT', body: { planned_on: a.date } }),
      ]);
      onSaved([first.draft, second.draft]);
      setMessage({ kind: 'ok', text: `'${a.title}'은 ${short(b.date)}, '${b.title}'은 ${short(a.date)}로 바꿨어요.` });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : '게시일을 바꾸지 못했어요.' });
    } finally { setBusy(false); setPicked(null); }
  };

  const press = (tile: GridTile) => {
    if (tile.kind !== 'planned' || busy) return;
    if (!picked) { setPicked(tile.id); setMessage(null); return; }
    if (picked === tile.id) { setPicked(null); return; }
    const first = tiles.find(t => t.id === picked);
    if (first) void swap(first, tile);
  };

  return (
    <section className="card step" aria-labelledby="grid-title">
      <h2 id="grid-title" className="step-title">인스타 격자 미리보기<span className="step-sub">예정 원고를 다 올렸을 때 프로필</span></h2>
      {tiles.length === 0 ? (
        <p className="muted small">게시일을 정한 원고가 생기면 여기서 프로필 격자로 미리 볼 수 있어요.</p>
      ) : (
        <>
          <p className="muted small">게시 예정 칸 두 개를 차례로 누르면 두 원고의 게시일을 맞바꿔요. 사진은 원고의 첫 사진이에요.</p>
          <ul className="insta-grid" aria-label="인스타 프로필 격자">
            {tiles.map(tile => {
              const cover = covers[tile.id];
              const label = `${tile.title}, ${short(tile.date)} ${tile.kind === 'planned' ? '게시 예정' : '게시함'}`;
              return (
                <li key={tile.id}>
                  <button type="button" className={`grid-tile k-${tile.kind}`} aria-label={label} aria-pressed={tile.kind === 'planned' ? picked === tile.id : undefined}
                    disabled={tile.kind !== 'planned' || busy} onClick={() => press(tile)}>
                    {cover ? <img src={`/api/photos/${cover}`} alt="" loading="lazy" /> : <span className="grid-title">{tile.title}</span>}
                    <span className="grid-date">{short(tile.date)}{tile.kind === 'planned' ? ' 예정' : ''}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {picked && <p className="small" role="status">바꿀 다른 게시 예정 칸을 누르세요. 같은 칸을 다시 누르면 취소돼요.</p>}
        </>
      )}
      {message && <p className={message.kind === 'error' ? 'error small' : 'small'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </section>
  );
}
