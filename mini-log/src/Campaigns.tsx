import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Skeleton } from './Skeleton';
import { Help } from './Help';
import { MoreMenu } from './MoreMenu';
import { EmptyState } from './EmptyState';
import { showUndo } from './UndoToast';
import { api, formatNumber } from '../../shared/client/api';
import { Tomong } from './Tomong';
import { GuideChips, GuideFill, type Guide, type GuideResult } from './GuideFill';
import { campaignsCsv, downloadCsv } from './csvExport';
import { AD_SOURCE_LABEL, parseAdCsv, type AdSource } from './adsImport';
import { loadPrefs, PLATFORMS, savePrefs, searchUrl, type Shared } from './campaignFinder';

// 협찬·광고 캠페인과 수익 기록(본인만 보는 계약 정보)
export type Kind = 'sponsor' | 'ad' | 'other';
export type Status = 'interested' | 'applied' | 'proposed' | 'in_progress' | 'posted' | 'paid' | 'cancelled';
export interface Campaign {
  id: string; kind: Kind; brand: string; title: string; provided: string; amount: number;
  deadline: string | null; status: Status; paid_on: string | null; draft_id: string | null; memo: string; guide: Guide | null; pitch: PitchLog | null; suggest?: { status: Status; reason: string } | null;
  source_url: string; apply_by: string | null; created_at: number; updated_at: number;
}
/** 먼저 제안한 기록(제안 화면의 '보낸 걸로 기록') */
export interface PitchLog { on: string; via: 'mail' | 'dm'; reply: 'waiting' | 'yes' | 'no' }
const REPLY_LABEL: Record<PitchLog['reply'], string> = { waiting: '답장 기다림', yes: '좋다고 함', no: '거절' };
/** 제안 뒤 지난 날 수(한국 날짜) */
export const daysSince = (date: string) => Math.round((Date.parse(`${todayKst()}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
export const KIND_LABEL: Record<Kind, string> = { sponsor: '협찬', ad: '광고 수익', other: '기타' };
export const STATUS_LABEL: Record<Status, string> = { interested: '관심', applied: '신청함', proposed: '제안 받음', in_progress: '진행 중', posted: '게시 완료', paid: '정산 완료', cancelled: '취소' };
const OPEN: Status[] = ['proposed', 'in_progress', 'posted'];
/** 체험단 공고를 담아 둔 단계(선정 전). 받을 금액에 넣지 않는다. */
const WISH: Status[] = ['interested', 'applied'];
/** 다음 단계로 한 번에: 관심 → 신청함 → 선정(진행 중) */
const NEXT: Partial<Record<Status, [Status, string]>> = { interested: ['applied', '신청했어요'], applied: ['in_progress', '선정됐어요'] };
type Filter = 'open' | 'wish' | 'paid' | 'cancelled' | 'all' | 'brand';
const FILTERS: [Filter, string][] = [['open', '진행 중'], ['wish', '관심·신청'], ['paid', '정산 완료'], ['cancelled', '취소'], ['all', '전체'], ['brand', '업체별']];

export const won = (n: number) => `${formatNumber(n)}원`;
/** 한국 날짜(YYYY-MM-DD) */
export const todayKst = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
export function dDay(deadline: string) {
  const diff = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${todayKst()}T00:00:00Z`)) / 86400000);
  return diff === 0 ? 'D-day' : diff > 0 ? `D-${diff}` : `${-diff}일 지남`;
}

type Form = Omit<Campaign, 'id' | 'created_at' | 'updated_at' | 'amount'> & { amount: string };
const EMPTY: Form = { kind: 'sponsor', brand: '', title: '', provided: '', amount: '', deadline: null, status: 'proposed', paid_on: null, draft_id: null, memo: '', guide: null, pitch: null, source_url: '', apply_by: null };

export function CampaignsView({ drafts, onBack, onOpenDraft, onProposal, shared = null }: {
  drafts: { id: string; title: string }[]; onBack: () => void; onOpenDraft: (id: string) => void; onProposal: () => void;
  /** 휴대폰 공유로 받은 공고(있으면 '관심' 새 협찬으로 연다) */
  shared?: Shared | null;
}) {
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [moreHidden, setMoreHidden] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState<Filter>('open');
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const [shareUrl] = useState(shared?.url ?? '');
  useEffect(() => {
    if (!shared) return;
    setFilter('wish');
    setEditing({ id: null, form: { ...EMPTY, status: 'interested', source_url: shared.url, title: shared.title } });
    setMessage({ kind: 'info', text: '공유한 공고를 관심으로 담을게요. \'정리하기\'를 누르면 공고 내용으로 칸을 채워요.' });
  }, [shared]);
  useEffect(() => {
    api<{ campaigns: Campaign[]; more?: boolean }>('/api/campaigns').then(d => { setItems(d.campaigns); setMoreHidden(!!d.more); })
      .catch(e => setMessage({ kind: 'error', text: e instanceof Error ? e.message : '불러오지 못했어요.' }));
  }, []);

  // 단계 이동 제안이 있는 협찬은 어느 목록에서든 보이게(놓치지 않게)
  const shown = useMemo(() => (items ?? []).filter(c => filter === 'all' || !!c.suggest || (filter === 'open' ? OPEN.includes(c.status) : filter === 'wish' ? WISH.includes(c.status) : c.status === filter)), [items, filter]);
  // 업체별: 같은 업체와 한 일을 모아 건수·받은 금액·마지막 날
  const brands = useMemo(() => {
    const map = new Map<string, { brand: string; count: number; paid: number; open: number; last: string }>();
    for (const c of items ?? []) {
      if (c.kind !== 'sponsor') continue;
      const key = c.brand.trim();
      const cur = map.get(key) ?? { brand: key, count: 0, paid: 0, open: 0, last: '' };
      cur.count++;
      if (c.status === 'paid') cur.paid += c.amount;
      if (OPEN.includes(c.status)) cur.open++;
      const day = c.paid_on ?? c.deadline ?? c.pitch?.on ?? new Date(c.updated_at + 9 * 3600000).toISOString().slice(0, 10);
      if (day > cur.last) cur.last = day;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.paid - a.paid || b.count - a.count);
  }, [items]);
  const month = todayKst().slice(0, 7);
  const summary = useMemo(() => {
    const list = items ?? [];
    const open = list.filter(c => OPEN.includes(c.status));
    return {
      openCount: open.length,
      openAmount: open.reduce((n, c) => n + c.amount, 0),
      paidThisMonth: list.filter(c => c.status === 'paid' && c.paid_on?.startsWith(month)).reduce((n, c) => n + c.amount, 0),
    };
  }, [items, month]);

  function startNew(kind: Kind = 'sponsor') {
    setMessage(null);
    setEditing({ id: null, form: { ...EMPTY, kind, status: kind === 'sponsor' ? 'proposed' : 'paid', paid_on: kind === 'sponsor' ? null : todayKst() } });
  }
  function startEdit(c: Campaign) {
    setMessage(null);
    setEditing({ id: c.id, form: { ...c, amount: String(c.amount) } });
  }
  const set = (patch: Partial<Form>) => setEditing(e => (e ? { ...e, form: { ...e.form, ...patch } } : e));
  // 가이드 정리 결과는 빈 칸만 채우고(이미 적은 건 그대로), 가이드는 새로 바꾼다
  const fillFromGuide = (r: GuideResult, sourceUrl?: string) => setEditing(e => {
    if (!e) return e;
    const f = e.form;
    return { ...e, form: { ...f, brand: f.brand.trim() || r.brand, title: f.title.trim() || r.title, provided: f.provided.trim() || r.provided,
      amount: f.amount.trim() || (r.amount ? String(r.amount) : ''), deadline: f.deadline || r.deadline, guide: r.guide,
      apply_by: f.apply_by || r.apply_by || null, source_url: f.source_url.trim() || sourceUrl || '' } };
  });

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const { form } = editing;
    if (form.kind === 'sponsor' && !form.brand.trim()) { setMessage({ kind: 'error', text: '업체 이름을 적어 주세요.' }); return; }
    const amount = form.amount.replace(/[,\s원]/g, '');
    if (amount && !/^\d+$/.test(amount)) { setMessage({ kind: 'error', text: '금액은 숫자로 적어 주세요.' }); return; }
    setBusy(true);
    try {
      const body = { ...form, amount: Number(amount || 0) };
      const { campaign } = editing.id
        ? await api<{ campaign: Campaign }>(`/api/campaigns/${editing.id}`, { method: 'PUT', body })
        : await api<{ campaign: Campaign }>('/api/campaigns', { body });
      setItems(list => (editing.id ? (list ?? []).map(c => (c.id === campaign.id ? campaign : c)) : [campaign, ...(list ?? [])]));
      setEditing(null);
      setMessage({ kind: 'info', text: '저장했어요.' });
    } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '저장하지 못했어요.' }); }
    finally { setBusy(false); }
  }

  /** 목록에서 바로 다음 단계로(관심 → 신청함 → 선정). 선정되면 진행 중 목록으로 옮겨 간다. */
  async function advance(c: Campaign) {
    const next = NEXT[c.status];
    if (!next) return;
    try {
      const { campaign } = await api<{ campaign: Campaign }>(`/api/campaigns/${c.id}`, { method: 'PUT', body: { status: next[0] } });
      setItems(list => (list ?? []).map(x => (x.id === campaign.id ? campaign : x)));
      setMessage({ kind: 'info', text: next[0] === 'in_progress' ? `${c.brand}: 선정! 진행 중으로 옮겼어요. 리뷰 마감일을 적어 두세요.` : `${c.brand}: 신청함으로 바꿨어요.` });
    } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '바꾸지 못했어요.' }); }
  }

  /** 메일로 본 단계 이동 제안: '옮기기'면 그 단계로, '아니에요'면 제안만 지운다 */
  async function decide(c: Campaign, accept: boolean) {
    if (!c.suggest) return;
    try {
      const { campaign } = await api<{ campaign: Campaign }>(`/api/campaigns/${c.id}`, { method: 'PUT', body: accept ? { status: c.suggest.status } : { suggest: null } });
      setItems(list => (list ?? []).map(x => (x.id === campaign.id ? campaign : x)));
      setMessage({ kind: 'info', text: accept ? `${c.brand}: ${STATUS_LABEL[c.suggest.status]}(으)로 옮겼어요.` : `${c.brand}: 제안을 지웠어요. 단계는 그대로예요.` });
    } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '바꾸지 못했어요.' }); }
  }

  // 지우기: 확인 창 대신 바로 지우고 '되돌리기' 알림(서버 휴지통에 10분)
  async function remove() {
    if (!editing?.id) return;
    const id = editing.id, name = editing.form.brand.trim() || '협찬';
    try {
      await api(`/api/campaigns/${id}`, { method: 'DELETE' });
      setItems(list => (list ?? []).filter(c => c.id !== id));
      setEditing(null);
      showUndo(`'${name.slice(0, 20)}' 기록을 지웠어요`, async () => {
        await api(`/api/trash/${id}/restore`, { method: 'POST', body: {} });
        const d = await api<{ campaigns: Campaign[] }>('/api/campaigns');
        setItems(d.campaigns);
      });
    } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '지우지 못했어요.' }); }
  }

  const draftTitle = (id: string | null) => (id ? drafts.find(d => d.id === id)?.title.trim() || '제목 없는 원고' : '');

  return (
    <article className="stack" aria-labelledby="camp-title">
      <div className="editor-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn ghost back" onClick={onBack}>← 목록</button>
          <h1 id="camp-title" style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>협찬·수익</h1>
        </div>
        {/* 힉의 법칙: 자주 쓰는 '새 협찬' 하나만 보이고, 가끔 쓰는 것은 ⋯ 안으로 */}
        <div className="actions">
          <button className="btn primary" onClick={() => startNew('sponsor')}>새 협찬</button>
          <MoreMenu label="협찬 메뉴">
            <button className="btn ghost" onClick={onProposal}>제안서·메일 만들기</button>
            <button className="btn ghost" onClick={() => setImporting(v => !v)} aria-expanded={importing}>광고 수익 가져오기</button>
            <button className="btn ghost" onClick={() => startNew('ad')}>광고 수익 적기</button>
            <button className="btn ghost" disabled={!items?.length} onClick={() => {
              const list = filter === 'brand' ? items ?? [] : shown;
              downloadCsv(campaignsCsv(list), `minilog_campaigns_${todayKst().replace(/-/g, '')}.csv`);
              setMessage({ kind: 'info', text: `${list.length}건을 CSV로 받았어요(지금 보는 목록 기준).` });
            }}>CSV로 받기</button>
          </MoreMenu>
        </div>
      </div>
      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}

      {importing && <AdImport onClose={() => setImporting(false)} onDone={() => { api<{ campaigns: Campaign[] }>('/api/campaigns').then(d => setItems(d.campaigns)).catch(() => {}); }} />}

      <div className="kpis three">
        <div className="card kpi"><span className="label">진행 중</span><span className="value">{formatNumber(summary.openCount)}건</span><span className="hint">제안·진행·게시 완료</span></div>
        <div className="card kpi"><span className="label">받을 금액</span><span className="value">{won(summary.openAmount)}</span><span className="hint">진행 중인 것의 합계</span></div>
        <div className="card kpi"><span className="label">{Number(month.slice(5))}월 받은 금액</span><span className="value">{won(summary.paidThisMonth)}</span><span className="hint">정산 완료 기준</span></div>
      </div>

      {editing && (
        <form className="card step" onSubmit={save} aria-label={editing.id ? '캠페인 고치기' : '새 기록'}>
          <div className="row-between">
            <h2 className="step-title">{editing.id ? '기록 고치기' : editing.form.kind === 'sponsor' ? '새 협찬' : '새 수익'}</h2>
            {editing.form.kind === 'sponsor' && <GuideFill onFill={fillFromGuide} initialUrl={!editing.id && editing.form.source_url === shareUrl ? shareUrl : ''} />}
          </div>
          {editing.form.kind === 'sponsor' && editing.form.guide && (
            <div>
              <GuideChips guide={editing.form.guide} />
              <button type="button" className="btn ghost small" onClick={() => set({ guide: null })}>가이드 지우기</button>
            </div>
          )}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="c-kind">종류</label>
              <select id="c-kind" className="input" value={editing.form.kind} onChange={e => set({ kind: e.target.value as Kind })}>
                {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="c-status">상태</label>
              <select id="c-status" className="input" value={editing.form.status} onChange={e => { const status = e.target.value as Status; set({ status, paid_on: status === 'paid' ? editing.form.paid_on || todayKst() : editing.form.paid_on }); }}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="c-brand">{editing.form.kind === 'sponsor' ? '업체' : '어디서(선택)'}</label>
              <input id="c-brand" className="input" value={editing.form.brand} maxLength={60} placeholder={editing.form.kind === 'ad' ? '예: 애드포스트' : '예: ○○카페'} onChange={e => set({ brand: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="c-title">캠페인 이름(선택)</label>
              <input id="c-title" className="input" value={editing.form.title} maxLength={100} onChange={e => set({ title: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="c-amount">금액(원)</label>
              <input id="c-amount" className="input" inputMode="numeric" value={editing.form.amount} placeholder="0" onChange={e => set({ amount: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="c-deadline">마감일(선택)</label>
              <input id="c-deadline" className="input" type="date" value={editing.form.deadline ?? ''} onChange={e => set({ deadline: e.target.value || null })} />
            </div>
            {editing.form.status === 'paid' && (
              <div className="field">
                <label htmlFor="c-paid">받은 날</label>
                <input id="c-paid" className="input" type="date" value={editing.form.paid_on ?? ''} onChange={e => set({ paid_on: e.target.value || null })} />
              </div>
            )}
            <div className="field">
              <label htmlFor="c-draft">연결 원고(선택)</label>
              <select id="c-draft" className="input" value={editing.form.draft_id ?? ''} onChange={e => set({ draft_id: e.target.value || null })}>
                <option value="">없음</option>
                {drafts.map(d => <option key={d.id} value={d.id}>{d.title.trim() || '제목 없는 원고'}</option>)}
              </select>
            </div>
          </div>
          {editing.form.kind === 'sponsor' && (
            <div className="form-grid">
              <div className="field">
                <label htmlFor="c-source">모집 공고 주소(선택)</label>
                <input id="c-source" className="input" type="url" inputMode="url" maxLength={500} placeholder="https://… 체험단 공고 페이지" value={editing.form.source_url} onChange={e => set({ source_url: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="c-apply">신청 기한(선택)</label>
                <input id="c-apply" className="input" type="date" value={editing.form.apply_by ?? ''} onChange={e => set({ apply_by: e.target.value || null })} />
              </div>
            </div>
          )}
          {editing.form.kind === 'sponsor' && (
            <div className="field">
              <label htmlFor="c-provided">제공 내용(선택)</label>
              <textarea id="c-provided" className="textarea" style={{ minHeight: 80 }} value={editing.form.provided} maxLength={500} placeholder="예: 2인 식사권, 원고료 10만 원, 사진 5장 이상" onChange={e => set({ provided: e.target.value })} />
            </div>
          )}
          {editing.form.pitch && (
            <div className="field">
              <label htmlFor="c-reply">답장 · {editing.form.pitch.on.slice(5).replace('-', '/')} {editing.form.pitch.via === 'mail' ? '메일' : 'DM'}로 제안</label>
              <select id="c-reply" className="input" value={editing.form.pitch.reply} onChange={e => {
                const reply = e.target.value as PitchLog['reply'];
                const status = reply === 'yes' && editing.form.status === 'proposed' ? 'in_progress' : reply === 'no' ? 'cancelled' : editing.form.status;
                set({ pitch: { ...editing.form.pitch!, reply }, status });
              }}>
                {Object.entries(REPLY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="c-memo">메모(선택)</label>
            <textarea id="c-memo" className="textarea" style={{ minHeight: 70 }} value={editing.form.memo} maxLength={1000} onChange={e => set({ memo: e.target.value })} />
          </div>
          <div className="ai-row">
            <button className="btn primary" type="submit" disabled={busy}>{busy ? '저장하는 중…' : '저장'}</button>
            <button className="btn ghost" type="button" onClick={() => setEditing(null)}>취소</button>
            {editing.id && <button className="btn ghost" type="button" onClick={remove}>지우기</button>}
          </div>
        </form>
      )}

      <section className="card step" aria-labelledby="camp-list">
        <div className="row-between">
          <h2 id="camp-list" className="step-title">기록</h2>
          <div className="style-tabs" role="tablist" aria-label="보기">
            {FILTERS.map(([key, label]) => <button key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
          </div>
        </div>
        {filter === 'wish' && <Finder />}
        {items === null && !message && <Skeleton rows={4} />}
        {items && filter === 'brand' && (brands.length === 0
          ? <p className="muted small" style={{ margin: 0 }}>협찬 기록이 생기면 업체별로 모아 보여요.</p>
          : (
            <ul className="brand-list" aria-label="업체별">
              {brands.map(b => (
                <li key={b.brand}>
                  <button className="campaign" onClick={() => { setFilter('all'); }} aria-label={`${b.brand} 기록 보기`}>
                    <span className="c-main">
                      <span className="c-brand">{b.brand}</span>
                      <span className="c-meta"><span className="muted small">{b.count}건{b.open ? ` · 진행 중 ${b.open}` : ''} · 마지막 {b.last.slice(2).replace(/-/g, '.')}</span></span>
                    </span>
                    <span className="c-amount">{b.paid ? won(b.paid) : '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
        {items && filter !== 'brand' && shown.length === 0 && (
          filter === 'open' ? <EmptyState title="진행 중인 협찬이 없어요" desc="받은 제안·마감·금액을 한곳에서 챙겨요. 마감일은 캘린더에도 떠요." action={{ label: '첫 협찬 적기', onClick: () => startNew('sponsor') }}
            example={<div className="campaign-example"><b>성수과일당 · 겨울 타르트 체험단</b><span className="muted small">제안 받음 · 마감 12/20 · 50,000원</span></div>} />
          : filter === 'wish' ? <EmptyState title="관심 있는 체험단이 없어요" desc="공고를 새 협찬으로 담고 상태를 '관심'으로 두면, 신청 마감일이 달력에도 떠요." action={{ label: '첫 협찬 적기', onClick: () => startNew('sponsor') }} />
          : <EmptyState title="기록이 없어요" />
        )}
        {moreHidden && <p className="muted small" style={{ margin: 0 }}>협찬이 많아 끝난 것 중 오래된 일부는 목록과 CSV에서 빠졌어요(대시보드 합계·월간 보고는 전체 기준).</p>}
        {filter !== 'brand' && shown.length > 0 && (
          <ul className="campaigns">
            {shown.map(c => (
              <li key={c.id}>
                <button className="campaign" onClick={() => startEdit(c)} aria-label={`${c.brand} ${c.title} 고치기`}>
                  <span className="c-main">
                    <span className="c-brand">{c.brand}{c.title && <span className="muted"> · {c.title}</span>}</span>
                    <span className="c-meta">
                      <span className={`badge s-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                      {c.kind !== 'sponsor' && <span className="badge">{KIND_LABEL[c.kind]}</span>}
                      {c.apply_by && c.status === 'interested' && <span className={`dday${dDay(c.apply_by).includes('지남') ? ' late' : ''}`}>신청 {c.apply_by.slice(5).replace('-', '/')} · {dDay(c.apply_by)}</span>}
                      {c.deadline && OPEN.includes(c.status) && <span className={`dday${dDay(c.deadline).includes('지남') ? ' late' : ''}`}>{c.deadline.slice(5).replace('-', '/')} · {dDay(c.deadline)}</span>}
                      {c.status === 'paid' && c.paid_on && <span className="muted small">{c.paid_on.slice(5).replace('-', '/')} 받음</span>}
                      {c.draft_id && <span className="muted small">원고: {draftTitle(c.draft_id)}</span>}
                      {c.pitch && c.status === 'proposed' && (
                        <span className={`pitch-chip${c.pitch.reply === 'waiting' && daysSince(c.pitch.on) >= 7 ? ' late' : ''}`}>
                          {c.pitch.via === 'mail' ? '메일' : 'DM'} 제안 · {c.pitch.reply === 'waiting' ? (daysSince(c.pitch.on) >= 7 ? `${daysSince(c.pitch.on)}일째 답장 없음, 다시 연락해 볼까요?` : `${daysSince(c.pitch.on)}일째 답장 기다림`) : REPLY_LABEL[c.pitch.reply]}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="c-amount">{c.amount ? won(c.amount) : '—'}</span>
                </button>
                {c.suggest && (
                  <div className="suggest" role="group" aria-label={`${c.brand} 단계 제안`}>
                    <span className="small">📩 {c.suggest.reason}</span>
                    <button type="button" className="btn small primary" onClick={() => { void decide(c, true); }}>{STATUS_LABEL[c.suggest.status]}(으)로 옮기기</button>
                    <button type="button" className="btn small ghost" onClick={() => { void decide(c, false); }}>아니에요</button>
                  </div>
                )}
                {NEXT[c.status] && <button className="btn small" onClick={() => { void advance(c); }}>{NEXT[c.status]![1]}</button>}
                {c.source_url && /^https:\/\//.test(c.source_url) && <a className="btn ghost small" href={c.source_url} target="_blank" rel="noopener noreferrer">공고 열기</a>}
                {c.draft_id && <button className="btn ghost small" onClick={() => onOpenDraft(c.draft_id!)}>원고 열기</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

// 광고 수익 가져오기(CSV): 애드센스·애드포스트 보고서를 달마다 더해 '광고' 수익으로 기록. 자동 연결은 준비 중.
function AdImport({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [source, setSource] = useState<AdSource>('adsense');
  const [preview, setPreview] = useState<{ months: { month: string; amount: number }[]; rows: number; skipped: number } | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function read(file: File | undefined) {
    setMessage(null); setPreview(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setMessage({ kind: 'error', text: '파일이 너무 커요(5MB까지).' }); return; }
    const parsed = parseAdCsv(await file.text());
    if (typeof parsed === 'string') setMessage({ kind: 'error', text: parsed }); else setPreview(parsed);
  }
  async function save() {
    if (!preview) return;
    setBusy(true); setMessage(null);
    try {
      const r = await api<{ added: number; updated: number }>('/api/campaigns/import-ads', { body: { source, months: preview.months } });
      setMessage({ kind: 'info', text: `${AD_SOURCE_LABEL[source]} 수익을 기록했어요(새로 ${r.added}달, 바꿈 ${r.updated}달). 월간 보고·대시보드에 들어가요.` });
      setPreview(null); onDone();
    } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '기록하지 못했어요.' }); }
    finally { setBusy(false); }
  }

  return (
    <section className="card step" aria-labelledby="ad-import-title">
      <div className="row-between"><h2 id="ad-import-title" className="step-title">광고 수익 가져오기(CSV)</h2><button className="btn ghost small" onClick={onClose}>닫기</button></div>
      <Help short={'애드센스·애드포스트에서 받은 CSV를 올리면 달마다 더해 적어요.'}>애드센스는 <b>보고서 → 날짜별 보고서 → 내보내기(CSV)</b>, 애드포스트는 <b>수입 내역 → 엑셀(CSV) 받기</b>로 받은 파일을 올리세요. 달마다 더해서 '광고 수익'으로 적어요. 같은 달을 다시 올리면 금액을 바꿔요.</Help>
      <div className="publish-row" style={{ alignItems: 'center' }}>
        <label className="sr-only" htmlFor="ad-source">광고 종류</label>
        <select id="ad-source" className="input" style={{ maxWidth: 160 }} value={source} onChange={e => setSource(e.target.value as AdSource)}>
          {(Object.keys(AD_SOURCE_LABEL) as AdSource[]).map(k => <option key={k} value={k}>{AD_SOURCE_LABEL[k]}</option>)}
        </select>
        <label className="btn">CSV 파일 고르기<input type="file" accept=".csv,.tsv,text/csv,text/plain" className="sr-only" onChange={e => { void read(e.target.files?.[0]); e.target.value = ''; }} /></label>
      </div>
      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}
      {preview && (
        <>
          <table className="mini-table" aria-label="가져올 광고 수익">
            <thead><tr><th>달</th><th>수익</th></tr></thead>
            <tbody>{preview.months.map(m => <tr key={m.month}><td>{m.month.slice(0, 4)}년 {Number(m.month.slice(5))}월</td><td>{won(m.amount)}</td></tr>)}</tbody>
          </table>
          <p className="muted small" style={{ margin: 0 }}>{preview.rows}줄을 읽었어요{preview.skipped ? `(합계·빈 줄 ${preview.skipped}줄 제외)` : ''}. 달러 보고서는 원화로 바꿔 받아 주세요.</p>
          <button className="btn primary" style={{ justifySelf: 'start' }} onClick={() => { void save(); }} disabled={busy}>{busy ? '기록하는 중…' : `${preview.months.length}달 기록하기`}</button>
        </>
      )}
      <p className="muted small" style={{ margin: 0 }}>애드센스 자동 연결(매일 자동으로 가져오기)은 구글 앱 승인이 필요해서 준비 중이에요.</p>
    </section>
  );
}

/** 체험단 찾기: 내 지역·분야로 검색 화면을 연다(미니로그는 공고 사이트를 긁지 않음). 고른 공고는 주소를 붙여 넣거나 휴대폰 공유로 담는다. */
function Finder() {
  const [prefs, setPrefs] = useState(loadPrefs);
  // 처음 열 때만 정한다(지역을 치는 순간 접히지 않게): 아직 정한 게 없으면 펼쳐 둔다
  const [startOpen] = useState(() => !prefs.region && !prefs.topic);
  const set = (patch: Partial<typeof prefs>) => setPrefs(p => { const next = { ...p, ...patch }; savePrefs(next); return next; });
  return (
    <details className="finder" open={startOpen}>
      <summary>체험단 찾기 <span className="muted small">{[prefs.region, prefs.topic].filter(Boolean).join(' · ') || '지역·분야를 정해 두세요'}</span></summary>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="f-region">지역</label>
          <input id="f-region" className="input" maxLength={30} placeholder="예) 성수, 마포" value={prefs.region} onChange={e => set({ region: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="f-topic">분야</label>
          <input id="f-topic" className="input" maxLength={30} placeholder="예) 맛집, 뷰티, 배송형" value={prefs.topic} onChange={e => set({ topic: e.target.value })} />
        </div>
      </div>
      <div className="finder-links">
        <a className="btn primary small" href={searchUrl(prefs)} target="_blank" rel="noopener noreferrer">네이버에서 찾기</a>
        {PLATFORMS.map(([name, url]) => <a key={url} className="btn small" href={url} target="_blank" rel="noopener noreferrer">{name}</a>)}
      </div>
      <p className="muted small" style={{ margin: 0 }}>마음에 드는 공고는 주소를 복사해 '새 협찬 → ✨ 가이드로 채우기 → 링크'에 붙여 넣거나, 휴대폰에 설치한 미니로그로 공유하면 관심으로 담겨요. 신청은 그 사이트에서 직접 해요.</p>
    </details>
  );
}
