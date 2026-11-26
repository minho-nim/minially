import { useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/client/api';
import { Tomong } from './Tomong';
import { CalendarFeed } from './CalendarFeed';
import { InstaGrid } from './InstaGrid';
import { STATUS_LABEL as CAMPAIGN_STATUS, todayKst, type Campaign } from './Campaigns';

// 콘텐츠 캘린더: 게시 예정 원고·게시 완료 원고·협찬 마감을 한 달 달력에(모두 본인 것, 날짜는 한국 시간)
export interface CalendarDraft { id: string; title: string; status: 'draft' | 'approved' | 'published'; planned_on: string | null; published_at: number | null }
type Item = { kind: 'planned' | 'published' | 'deadline'; id: string; label: string; sub?: string; draftId?: string };

const kstDate = (ms: number) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

function monthDays(month: string) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first.getTime() - first.getUTCDay() * 86400000); // 그 주 일요일부터
  return Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10));
}
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
};

export function CalendarView<D extends CalendarDraft>({ drafts, onBack, onOpenDraft, onCreate, onSaved }: {
  drafts: D[]; onBack: () => void; onOpenDraft: (id: string) => void; onCreate: (date: string) => void; onSaved: (drafts: D[]) => void;
}) {
  const today = todayKst();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ campaigns: Campaign[] }>('/api/campaigns').then(d => setCampaigns(d.campaigns)).catch(e => setError(e instanceof Error ? e.message : '협찬 마감을 불러오지 못했어요.'));
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    const add = (day: string, item: Item) => map.set(day, [...(map.get(day) ?? []), item]);
    for (const d of drafts) {
      const title = d.title.trim() || '제목 없는 원고';
      if (d.status === 'published' && d.published_at) add(kstDate(d.published_at), { kind: 'published', id: `p${d.id}`, label: title, sub: '게시 완료', draftId: d.id });
      else if (d.planned_on) add(d.planned_on, { kind: 'planned', id: `d${d.id}`, label: title, sub: d.status === 'approved' ? '승인됨 · 게시 예정' : '게시 예정', draftId: d.id });
    }
    for (const c of campaigns) {
      if (c.deadline && ['proposed', 'in_progress', 'posted'].includes(c.status)) {
        add(c.deadline, { kind: 'deadline', id: `c${c.id}`, label: `${c.brand}${c.title ? ` · ${c.title}` : ''}`, sub: `협찬 마감 · ${CAMPAIGN_STATUS[c.status]}`, draftId: c.draft_id ?? undefined });
      }
      if (c.apply_by && c.status === 'interested') add(c.apply_by, { kind: 'deadline', id: `a${c.id}`, label: `${c.brand}${c.title ? ` · ${c.title}` : ''}`, sub: '체험단 신청 마감' });
    }
    return map;
  }, [drafts, campaigns]);

  const days = monthDays(month);
  const items = byDay.get(selected) ?? [];
  const [y, m] = month.split('-').map(Number);
  const selectedLabel = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'UTC' }).format(new Date(`${selected}T00:00:00Z`));

  return (
    <article className="stack" aria-labelledby="cal-title">
      <div className="editor-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn ghost back" onClick={onBack}>← 목록</button>
          <h1 id="cal-title" style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>캘린더</h1>
        </div>
        <div className="actions cal-nav">
          <button className="btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달">‹</button>
          <span className="cal-month" aria-live="polite">{y}년 {m}월</span>
          <button className="btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="다음 달">›</button>
          <button className="btn ghost" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }}>오늘</button>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="cal-legend" aria-label="표시">
        <li><i className="k-planned" />게시 예정</li><li><i className="k-published" />게시 완료</li><li><i className="k-deadline" />협찬 마감</li>
      </ul>

      <div className="card cal" role="grid" aria-label={`${y}년 ${m}월`}>
        <div className="cal-row cal-head" role="row">{WEEK.map((w, i) => <span key={w} role="columnheader" className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</span>)}</div>
        {Array.from({ length: 6 }, (_, week) => (
          <div className="cal-row" role="row" key={week}>
            {days.slice(week * 7, week * 7 + 7).map((day, i) => {
              const list = byDay.get(day) ?? [];
              const out = day.slice(0, 7) !== month;
              return (
                <button key={day} role="gridcell" aria-selected={day === selected} aria-label={`${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일, 일정 ${list.length}개`}
                  className={`cal-day${out ? ' out' : ''}${day === today ? ' today' : ''}${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}
                  onClick={() => { setSelected(day); if (out) setMonth(day.slice(0, 7)); }}>
                  <span className="cal-num">{Number(day.slice(8))}</span>
                  <span className="cal-items">
                    {list.slice(0, 3).map(item => <span key={item.id} className={`cal-chip k-${item.kind}`}>{item.label}</span>)}
                    {list.length > 3 && <span className="cal-more">+{list.length - 3}</span>}
                  </span>
                  <span className="cal-dots" aria-hidden="true">{list.slice(0, 4).map(item => <i key={item.id} className={`k-${item.kind}`} />)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <section className="card step" aria-labelledby="cal-day-title">
        <div className="row-between">
          <h2 id="cal-day-title" className="step-title">{selectedLabel}{selected === today && <span className="step-sub">오늘</span>}</h2>
          <button className="btn primary" onClick={() => onCreate(selected)}>이 날 게시할 원고 만들기</button>
        </div>
        {items.length === 0 ? (
          <div className="profile"><Tomong kind="minilog" size={40} /><p className="muted small" style={{ margin: 0 }}>이 날은 비어 있어요.</p></div>
        ) : (
          <ul className="cal-list">
            {items.map(item => (
              <li key={item.id}>
                <i className={`k-${item.kind}`} aria-hidden="true" />
                <span className="c-main"><b>{item.label}</b><span className="muted small">{item.sub}</span></span>
                {item.draftId && <button className="btn ghost small" onClick={() => onOpenDraft(item.draftId!)}>원고 열기</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <InstaGrid drafts={drafts} today={today} onSaved={onSaved} />
      <CalendarFeed />
    </article>
  );
}
