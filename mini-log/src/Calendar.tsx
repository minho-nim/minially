import { useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/client/api';
import { Tomong } from './Tomong';
import { CalendarFeed } from './CalendarFeed';
import { InstaGrid } from './InstaGrid';
import { STATUS_LABEL as CAMPAIGN_STATUS, todayKst, type Campaign } from './Campaigns';

// 콘텐츠 캘린더: 게시 예정 원고·게시 완료 원고·협찬 마감을 한 달 달력에(모두 본인 것, 날짜는 한국 시간)
export interface CalendarDraft { id: string; title: string; status: 'draft' | 'approved' | 'published'; planned_on: string | null; published_at: number | null }
type Item = { kind: 'planned' | 'published' | 'deadline' | 'google'; id: string; label: string; sub?: string; draftId?: string };
interface GoogleEvent { day: string; title: string; start: string | null; end: string | null; location: string }
interface GoogleCal { connected: boolean; masked?: string; events: GoogleEvent[]; error?: string }

const kstDate = (ms: number) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const DRAG_TYPE = 'application/x-minilog-draft';

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
  const [rhythm, setRhythm] = useState<number[]>([]);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  // 구글 캘린더 겹쳐 보기(읽기만, 계정마다 주소 하나): 캘린더를 열 때마다 서버가 읽어 온다
  const [gcal, setGcal] = useState<GoogleCal | null>(null);
  const loadGcal = () => api<GoogleCal>('/api/calendar/google').then(setGcal).catch(() => setGcal({ connected: false, events: [], error: '구글 캘린더를 불러오지 못했어요.' }));
  useEffect(() => { void loadGcal(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api<{ campaigns: Campaign[] }>('/api/campaigns').then(d => setCampaigns(d.campaigns)).catch(e => setError(e instanceof Error ? e.message : '협찬 마감을 불러오지 못했어요.'));
    api<{ days: number[] }>('/api/plan').then(d => setRhythm(d.days)).catch(() => setRhythm([])); // 게시 요일이 없어도 달력은 그대로
  }, []);

  // 날짜 없는 원고 서랍(Planoly·Later처럼): 끌어서 날짜 칸에 놓거나, 날짜를 고른 뒤 '이 날로'를 누른다
  const unscheduled = drafts.filter(d => d.status !== 'published' && !d.planned_on);
  async function assign(id: string, day: string) {
    setError(''); setNotice('');
    try {
      const { draft } = await api<{ draft: D }>(`/api/drafts/${id}`, { method: 'PUT', body: { planned_on: day } });
      onSaved([draft]);
      setNotice(`'${draft.title.trim() || '제목 없는 원고'}'을 ${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일에 잡았어요.`);
    } catch (e) { setError(e instanceof Error ? e.message : '날짜를 잡지 못했어요.'); }
  }

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
    (gcal?.events ?? []).forEach((e, i) => add(e.day, { kind: 'google', id: `g${i}`, label: e.title, sub: ['구글 캘린더', e.start ? `${e.start}${e.end ? `~${e.end}` : ''}` : '종일', e.location].filter(Boolean).join(' · ') }));
    return map;
  }, [drafts, campaigns, gcal]);

  const days = monthDays(month);
  const items = byDay.get(selected) ?? [];
  const [y, m] = month.split('-').map(Number);
  const selectedShort = `${Number(selected.slice(5, 7))}/${Number(selected.slice(8))}`;
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
        <li><i className="k-planned" />게시 예정</li><li><i className="k-published" />게시 완료</li><li><i className="k-deadline" />협찬 마감</li>{gcal?.connected && <li><i className="k-google" />구글 일정</li>}
      </ul>

      {notice && <p className="muted small" role="status" style={{ margin: 0 }}>{notice}</p>}
      <div className="cal-layout">
      <section className="card step cal-drawer" aria-labelledby="drawer-title">
        <h2 id="drawer-title" className="step-title">날짜 없는 원고<span className="step-sub">{unscheduled.length}개</span></h2>
        {unscheduled.length === 0 ? <p className="muted small" style={{ margin: 0 }}>모든 원고에 게시일이 있어요.</p> : (
          <>
            <ul className="drawer-list" aria-label="날짜 없는 원고">
              {unscheduled.slice(0, 30).map(d => {
                const title = d.title.trim() || '제목 없는 원고';
                return (
                  <li key={d.id} draggable onDragStart={e => { e.dataTransfer.setData(DRAG_TYPE, d.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDropDay(null)}>
                    <span className="drawer-title" title={title}>{title}</span>
                    <button type="button" className="btn small" aria-label={`'${title}' ${selectedShort}로 잡기`} onClick={() => { void assign(d.id, selected); }}>{selectedShort}로</button>
                  </li>
                );
              })}
            </ul>
            <p className="muted small" style={{ margin: 0 }}>끌어서 날짜 칸에 놓거나, 달력에서 날짜를 고르고 버튼을 누르세요.</p>
          </>
        )}
      </section>
      <div className="cal-center">
      <div className="card cal" role="grid" aria-label={`${y}년 ${m}월`}>
        <div className="cal-row cal-head" role="row">{WEEK.map((w, i) => <span key={w} role="columnheader" className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</span>)}</div>
        {Array.from({ length: 6 }, (_, week) => (
          <div className="cal-row" role="row" key={week}>
            {days.slice(week * 7, week * 7 + 7).map((day, i) => {
              const list = byDay.get(day) ?? [];
              const out = day.slice(0, 7) !== month;
              return (
                <button key={day} role="gridcell" aria-selected={day === selected} aria-label={`${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일, 일정 ${list.length}개`}
                  className={`cal-day${out ? ' out' : ''}${day === today ? ' today' : ''}${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}${dropDay === day ? ' drop' : ''}`}
                  onClick={() => { setSelected(day); if (out) setMonth(day.slice(0, 7)); }}
                  onDragOver={e => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); setDropDay(day); } }}
                  onDragLeave={() => setDropDay(d => (d === day ? null : d))}
                  onDrop={e => { e.preventDefault(); setDropDay(null); const id = e.dataTransfer.getData(DRAG_TYPE); if (id) { setSelected(day); void assign(id, day); } }}>
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
      </div>
      <div className="cal-side"><InstaGrid drafts={drafts} today={today} onSaved={onSaved} rhythm={rhythm} /></div>
      </div>
      <GoogleCalendarCard gcal={gcal} onChanged={loadGcal} />
      <CalendarFeed />
    </article>
  );
}

/** 구글 캘린더 연결(읽기만): 'iCal 형식의 비공개 주소'를 계정에 저장. 미니로그는 구글 캘린더를 바꾸지 않는다 */
function GoogleCalendarCard({ gcal, onChanged }: { gcal: GoogleCal | null; onChanged: () => Promise<void> }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  async function connect() {
    setBusy(true); setMsg(null);
    try { await api('/api/calendar/google', { method: 'PUT', body: { url } }); setUrl(''); await onChanged(); setMsg({ kind: 'info', text: '연결했어요. 구글 일정이 달력에 회색으로 겹쳐 보여요.' }); }
    catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : '연결하지 못했어요.' }); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    setBusy(true); setMsg(null);
    try { await api('/api/calendar/google', { method: 'DELETE' }); await onChanged(); setMsg({ kind: 'info', text: '구글 캘린더 연결을 끊었어요.' }); }
    catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : '끊지 못했어요.' }); }
    finally { setBusy(false); }
  }
  return (
    <section className="card step" aria-labelledby="gcal-title">
      <h2 id="gcal-title" className="step-title">구글 일정 겹쳐 보기{gcal?.connected && <span className="step-sub">일정 {gcal.events.length}개</span>}</h2>
      {gcal?.connected ? (
        <div className="ai-row">
          <span className="small" style={{ overflowWrap: 'anywhere' }}>연결됨 · {gcal.masked}</span>
          <button type="button" className="btn small ghost" onClick={() => { void disconnect(); }} disabled={busy}>연결 끊기</button>
        </div>
      ) : (
        <form className="stack" style={{ gap: 6 }} onSubmit={e => { e.preventDefault(); void connect(); }}>
          <label htmlFor="gcal-url" className="small">구글 캘린더 → 설정 → 내 캘린더 → 캘린더 통합의 ‘iCal 형식의 비공개 주소’</label>
          <div className="ai-row">
            <input id="gcal-url" className="input" type="url" inputMode="url" autoComplete="off" spellCheck={false} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" style={{ flex: '1 1 260px' }} />
            <button type="submit" className="btn" disabled={busy || !url.trim()}>{busy ? '확인하는 중…' : '연결'}</button>
          </div>
        </form>
      )}
      {gcal?.error && <p className="error small" role="alert" style={{ margin: 0 }}>{gcal.error}</p>}
      {msg && <p className={msg.kind === 'error' ? 'error small' : 'muted small'} role={msg.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{msg.text}</p>}
      <p className="muted small" style={{ margin: 0 }}>읽기만 해요(구글 캘린더는 바꾸지 않아요). 지난 한 달~앞으로 90일 일정을 볼 때마다 새로 읽고 저장하지 않아요. 비공개 주소는 남에게 알려 주지 마세요. 새어 나갔다면 구글에서 주소를 다시 만들고 여기서 다시 연결해 주세요.</p>
    </section>
  );
}
