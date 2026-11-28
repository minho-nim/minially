import { useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/client/api';
import { BriefCard, type Brief } from './Brief';
import { todayKst, won, type Campaign } from './Campaigns';
import { SourceSwitch, mailInSource, useSource } from './source';
import { Skeleton } from './Skeleton';

// 오늘 보드(첫 화면): 지금 할 일 · 다가오는 7일 · 답장할 메일 · 진행 흐름(협찬·내 글 한 줄씩) · 블로그/받을 돈/연결 계정.
// 기능을 이어서 보여 주고, 누르면 그 화면으로 간다. 보는 계정(전체·네이버·구글)으로 일정·메일을 거른다.
export interface TodayDraft { id: string; title: string; status: string; body: string; experience: string; planned_on: string | null; updated_at: number; photo_count?: number }
type Target = 'campaigns' | 'mail' | 'calendar' | 'blog' | 'settings' | 'drafts';
interface ExtEvent { day: string; title: string; start: string | null }
interface MailRow { id: string; from_name: string; from_addr: string; subject: string; brand: string; kind: string; needs_reply: number; status: string; account?: string; campaign_id: string | null }

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;

export function TodayBoard({ name, drafts, onOpenDraft, onCreate, onGo }: {
  name: string; drafts: TodayDraft[]; onOpenDraft: (id: string) => void; onCreate: () => void; onGo: (t: Target | 'ideas') => void;
}) {
  const source = useSource();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [camps, setCamps] = useState<Campaign[]>([]);
  const [mail, setMail] = useState<{ mails: MailRow[]; accounts?: { provider: string }[] } | null>(null);
  const [gcal, setGcal] = useState<{ connected: boolean; events: ExtEvent[] } | null>(null);
  const [ncal, setNcal] = useState<{ available: boolean; connected: boolean; events: ExtEvent[] } | null>(null);
  useEffect(() => {
    let alive = true;
    const keep = <T,>(set: (v: T) => void) => (v: T) => { if (alive) set(v); };
    // 하나가 실패해도 나머지 칸은 보인다
    api<Brief>('/api/brief').then(keep(setBrief)).catch(() => keep(setBrief)({ today: todayKst(), items: [], counts: { posted_week: 0, receivable: 0, waiting: 0, suggest: 0 } }));
    api<{ campaigns: Campaign[] }>('/api/campaigns').then(d => { if (alive) setCamps(d.campaigns); }).catch(() => {});
    api<{ mails: MailRow[]; accounts?: { provider: string }[] }>('/api/mail').then(keep(setMail)).catch(() => keep(setMail)({ mails: [], accounts: [] }));
    api<{ connected: boolean; events: ExtEvent[] }>('/api/calendar/google').then(keep(setGcal)).catch(() => keep(setGcal)({ connected: false, events: [] }));
    api<{ available: boolean; connected: boolean; events: ExtEvent[] }>('/api/calendar/naver').then(keep(setNcal)).catch(() => {});
    return () => { alive = false; };
  }, []);

  const today = todayKst();
  // 다가오는 7일: 내 원고 게시 예정 · 협찬 마감·신청 마감 · 구글·네이버 일정(보는 계정대로)
  const week = useMemo(() => {
    const end = addDays(today, 7);
    const rows: { day: string; label: string; tag: string; cls: string; go: () => void }[] = [];
    for (const d of drafts) if (d.planned_on && d.status !== 'published' && d.planned_on >= today && d.planned_on <= end) rows.push({ day: d.planned_on, label: `${d.title.trim() || '이름 없는 원고'} 게시`, tag: '내 원고', cls: 'mine', go: () => onOpenDraft(d.id) });
    for (const c of camps) {
      if (c.deadline && ['proposed', 'in_progress', 'posted'].includes(c.status) && c.deadline >= today && c.deadline <= end) rows.push({ day: c.deadline, label: `${c.brand} 마감`, tag: '협찬', cls: 'deal', go: () => onGo('campaigns') });
      if (c.apply_by && c.status === 'interested' && c.apply_by >= today && c.apply_by <= end) rows.push({ day: c.apply_by, label: `${c.brand} 신청 마감`, tag: '협찬', cls: 'deal', go: () => onGo('campaigns') });
    }
    if (source !== 'naver') for (const e of gcal?.events ?? []) if (e.day >= today && e.day <= end) rows.push({ day: e.day, label: `${e.title}${e.start ? ` ${e.start}` : ''}`, tag: '구글', cls: 'google', go: () => onGo('calendar') });
    if (source !== 'google') for (const e of ncal?.events ?? []) if (e.day >= today && e.day <= end) rows.push({ day: e.day, label: `${e.title}${e.start ? ` ${e.start}` : ''}`, tag: '네이버', cls: 'naver', go: () => onGo('calendar') });
    return rows.sort((a, b) => a.day.localeCompare(b.day)).slice(0, 6);
  }, [drafts, camps, gcal, ncal, source, today, onOpenDraft, onGo]);

  const waiting = (mail?.mails ?? []).filter(m => !!m.needs_reply && m.kind !== 'other' && m.kind !== 'outgoing' && (m.status === 'new' || m.status === 'drafted') && mailInSource(m.account, source));

  // 진행 흐름: 협찬 한 건·내 글 한 편을 한 줄로, 지금 할 단계에 ▶
  const flows = useMemo(() => {
    const byId = new Map(drafts.map(d => [d.id, d]));
    const rows: { key: string; name: string; tag: string; stages: string[]; now: number; nowLabel: string; go: () => void }[] = [];
    for (const c of camps.filter(x => x.kind === 'sponsor' && ['interested', 'applied', 'proposed', 'in_progress', 'posted'].includes(x.status)).slice(0, 5)) {
      const linked = c.draft_id ? byId.get(c.draft_id) : undefined;
      const now = c.status === 'posted' ? 4 : c.status === 'in_progress' ? (linked && linked.status === 'approved' ? 3 : 2) : 0;
      const nowLabel = now === 0 ? (c.status === 'interested' ? '신청' : c.status === 'applied' ? '선정 기다림' : '답장') : now === 2 ? (linked?.body.trim() ? '원고 점검' : '원고 쓰기') : now === 3 ? '게시' : '입금 확인';
      rows.push({ key: `c${c.id}`, name: c.brand, tag: '협찬', stages: ['연락', '선정', '원고', '게시', '정산'], now, nowLabel,
        go: () => ((now === 2 || now === 3) && c.draft_id ? onOpenDraft(c.draft_id) : onGo('campaigns')) });
    }
    const sponsorDrafts = new Set(camps.map(c => c.draft_id).filter(Boolean));
    for (const d of drafts.filter(x => x.status !== 'published' && !sponsorDrafts.has(x.id)).sort((a, b) => b.updated_at - a.updated_at).slice(0, 3)) {
      const done = [(d.photo_count ?? 0) > 0, !!d.experience.trim(), !!d.body.trim(), d.status !== 'draft', false];
      let now = done.findIndex((v, i) => !v && i > 0); // 사진은 선택이라 건너뛴다
      if (now < 0) now = 4;
      rows.push({ key: `d${d.id}`, name: d.title.trim() || '이름 없는 원고', tag: '내 글', stages: ['사진', '경험', '초안', '승인', '올리기'], now, nowLabel: ['사진', '경험 적기', '초안', '점검·승인', '올리기'][now], go: () => onOpenDraft(d.id) });
    }
    return rows;
  }, [camps, drafts, onOpenDraft, onGo]);

  const paidMonth = camps.filter(c => c.status === 'paid' && c.paid_on?.startsWith(today.slice(0, 7))).reduce((n, c) => n + c.amount, 0);
  const providers = new Set((mail?.accounts ?? []).map(a => a.provider));
  const links: [string, boolean][] = [['네이버 메일', providers.has('naver')], ['Gmail', providers.has('gmail')], ['구글 일정', !!gcal?.connected], ...(ncal?.available ? [['네이버 일정', !!ncal.connected] as [string, boolean]] : [])];

  return (
    <div className="today" aria-label="오늘 보드">
      <SourceSwitch note={source === 'naver' ? '네이버 일정·메일만' : '구글 일정·Gmail만'} />
      <div className="today-grid">
        {brief === null ? <Skeleton rows={3} label="오늘 할 일을 불러오는 중…" /> : <BriefCard name={name} data={brief} onGo={t => onGo(t === 'drafts' ? 'calendar' : t)} drafts={drafts} onOpenDraft={onOpenDraft} onCreate={onCreate} onIdeas={() => onGo('ideas')} />}
        <div className="today-side">
          <section className="card step" aria-labelledby="t-week">
            <div className="row-between"><h2 id="t-week" className="step-title">다가오는 7일</h2><button type="button" className="link-btn small" onClick={() => onGo('calendar')}>캘린더 →</button></div>
            {week.length === 0 ? <p className="muted small" style={{ margin: 0 }}>일주일 안에 잡힌 일이 없어요.</p> : (
              <ul className="today-list">
                {week.map((w, i) => <li key={i}><button type="button" onClick={w.go}><span className="today-day">{md(w.day)}</span><span className="today-t">{w.label}</span><span className={`today-tag t-${w.cls}`}>{w.tag}</span></button></li>)}
              </ul>
            )}
          </section>
          <section className="card step" aria-labelledby="t-mail">
            <div className="row-between"><h2 id="t-mail" className="step-title">답장할 메일<span className="step-sub">{waiting.length}통</span></h2><button type="button" className="link-btn small" onClick={() => onGo('mail')}>메일함 →</button></div>
            {mail === null ? <p className="muted small" style={{ margin: 0 }}>불러오는 중…</p> : waiting.length === 0 ? <p className="muted small" style={{ margin: 0 }}>{mail.accounts?.length ? '답장 기다리는 메일이 없어요.' : '메일이 아직 연결되지 않았어요.'}</p> : (
              <ul className="today-list">
                {waiting.slice(0, 3).map(m => <li key={m.id}><button type="button" onClick={() => onGo('mail')}><span className={`today-tag t-${m.account === 'gmail' ? 'google' : 'naver'}`}>{m.account === 'gmail' ? 'Gmail' : '네이버'}</span><span className="today-t">{m.brand || m.from_name || m.from_addr} · {m.subject}</span>{m.campaign_id && <span className="muted small">협찬 담음</span>}</button></li>)}
              </ul>
            )}
          </section>
        </div>
      </div>

      {flows.length > 0 && (
        <section className="card step" aria-labelledby="t-flow">
          <div className="row-between"><h2 id="t-flow" className="step-title">진행 흐름<span className="step-sub">주황 칸이 지금 할 단계</span></h2><button type="button" className="link-btn small" onClick={() => onGo('campaigns')}>단계판 →</button></div>
          <ul className="flow-list">
            {flows.map(f => (
              <li key={f.key} className="flow-row">
                <span className="flow-name"><b id={`fn-${f.key}`}>{f.name}</b><span className={`today-tag t-${f.tag === '협찬' ? 'deal' : 'mine'}`}>{f.tag}</span></span>
                <ol className="flow-steps" aria-describedby={`fn-${f.key}`}>
                  {f.stages.map((st, i) => i === f.now
                    ? <li key={st} className="now"><button type="button" onClick={f.go} aria-describedby={`fn-${f.key}`}>{f.nowLabel} ▶</button></li>
                    : <li key={st} className={i < f.now ? 'done' : ''}>{st}{i < f.now ? ' ✓' : ''}</li>)}
                </ol>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="today-sum">
        <section className="card step" aria-labelledby="t-blog">
          <div className="row-between"><h2 id="t-blog" className="step-title">내 블로그</h2><button type="button" className="link-btn small" onClick={() => onGo('blog')}>블로그 →</button></div>
          <p className="small" style={{ margin: 0 }}>이번 주 게시 <b>{brief?.counts.posted_week ?? 0}편</b> · 권장 3~5편</p>
        </section>
        <section className="card step" aria-labelledby="t-money">
          <div className="row-between"><h2 id="t-money" className="step-title">받을 돈</h2><button type="button" className="link-btn small" onClick={() => onGo('campaigns')}>협찬 →</button></div>
          <p className="small" style={{ margin: 0 }}>정산 대기 <b>{won(brief?.counts.receivable ?? 0)}</b> · {Number(today.slice(5, 7))}월 받음 <b>{won(paidMonth)}</b></p>
        </section>
        <section className="card step" aria-labelledby="t-acc">
          <div className="row-between"><h2 id="t-acc" className="step-title">연결 계정</h2><button type="button" className="link-btn small" onClick={() => onGo('settings')}>설정 →</button></div>
          <p className="small" style={{ margin: 0 }}>{mail === null || gcal === null ? '확인하는 중…' : links.map(([n, on]) => `${n} ${on ? '✓' : '✕'}`).join(' · ')}</p>
        </section>
      </div>
    </div>
  );
}
