import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, APP_LINKS, formatNumber } from '../../shared/client/api';
import { Tomong, Signature } from './Tomong';
import { renumberMarkers } from './photoMarkers';
import { CalendarView } from './Calendar';
import { BlogView } from './Blog';
import { CampaignsView, dDay, STATUS_LABEL as CAMPAIGN_STATUS, won, type Status as CampaignStatus } from './Campaigns';

type Status = 'draft' | 'approved' | 'published';
interface Draft {
  id: string; title: string; body: string; hashtags: string[]; experience: string;
  status: Status; published_url: string; published_at: number | null; style_id: string; planned_on: string | null; created_at: number; updated_at: number;
  photo_count?: number;
}
interface Photo { id: string; name: string; size: number; position: number; expires_at: number | null }
const STATUS_LABEL: Record<Status, string> = { draft: '작성 중', approved: '승인됨', published: '게시됨' };
const dayLabel = (ms: number) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(ms);

/** 올리기 전에 브라우저에서 긴 변을 1600px로 줄이고 JPG로 바꾼다(저장 공간·AI 토큰 절약, 위치 정보 등 메타데이터도 빠짐). */
async function shrinkPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error(`${file.name}: 이 사진 형식은 열 수 없어요(HEIC는 JPG로 바꿔 올려 주세요).`); }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('사진을 처리하지 못했어요.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('사진을 처리하지 못했어요.');
  return blob;
}

async function uploadPhoto(draftId: string, file: File): Promise<Photo> {
  const blob = await shrinkPhoto(file);
  let response: Response;
  try {
    response = await fetch(`/api/drafts/${draftId}/photos`, {
      method: 'POST', body: blob, credentials: 'same-origin',
      headers: { 'content-type': 'image/jpeg', 'x-file-name': encodeURIComponent(file.name.slice(0, 120)) },
    });
  } catch { throw new Error('인터넷 연결을 확인해 주세요.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError((data as { error?: string }).error ?? '사진을 올리지 못했어요.', response.status);
  return (data as { photo: Photo }).photo;
}
interface Me { user: 'C' | 'D'; gemini: { connected: boolean } }
type State = { kind: 'loading' } | { kind: 'login' } | { kind: 'error'; message: string } | { kind: 'ready'; me: Me };

export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const load = useCallback(async () => {
    try {
      const me = await api<Me | { user: null }>('/api/me');
      setState(me.user ? { kind: 'ready', me: me as Me } : { kind: 'login' });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : '불러오지 못했어요.' });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (state.kind === 'loading') return <main className="page"><p className="muted" role="status">불러오는 중…</p></main>;
  if (state.kind === 'login') return <Login onDone={load} />;
  if (state.kind === 'error') {
    return (
      <main className="page">
        <div className="card login stack" role="alert">
          <p className="error">{state.message}</p>
          <button className="btn" onClick={() => { setState({ kind: 'loading' }); void load(); }}>다시 시도</button>
        </div>
      </main>
    );
  }
  return <Workspace me={state.me} onLogout={() => setState({ kind: 'login' })} />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) { setError('코드를 입력해 주세요.'); return; }
    setBusy(true); setError('');
    try { await api('/api/login', { body: { code } }); setCode(''); onDone(); }
    catch (err) { setError(err instanceof Error ? err.message : '로그인하지 못했어요.'); }
    finally { setBusy(false); }
  }
  return (
    <main className="page">
      <form className="card login stack" onSubmit={submit} noValidate>
        <div className="login-hero">
          <Tomong kind="minilog" size={88} pose="wave" bounce />
          <h1 className="sr-only">미니로그 로그인</h1>
          <Signature kind="minilog" word="log" size={22} tomong={0} />
          <p className="hand login-line">미니어리 코드로 들어와요</p>
        </div>
        <div className="field">
          <label htmlFor="code">로그인 코드</label>
          <input id="code" className="input" value={code} onChange={e => setCode(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-invalid={!!error} aria-describedby={error ? 'code-error' : undefined} />
        </div>
        {error && <p id="code-error" className="error" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? '확인하는 중…' : '로그인'}</button>
      </form>
    </main>
  );
}

const dateLabel = (ms: number) => new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ms);

function Workspace({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>('drafts');
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try { setDrafts((await api<{ drafts: Draft[] }>('/api/drafts')).drafts); setListError(''); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) onLogout();
      else setListError(error instanceof Error ? error.message : '원고 목록을 불러오지 못했어요.');
    }
  }, [onLogout]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function create(plannedOn?: string) {
    setCreating(true);
    try {
      const { draft } = await api<{ draft: Draft }>('/api/drafts', { method: 'POST', body: plannedOn ? { planned_on: plannedOn } : {} });
      setDrafts(list => [draft, ...(list ?? [])]);
      setSelectedId(draft.id);
      setView('drafts');
    } catch (error) { setListError(error instanceof Error ? error.message : '새 원고를 만들지 못했어요.'); }
    finally { setCreating(false); }
  }

  async function logout() {
    try { await api('/api/logout', { method: 'POST', body: {} }); } catch { /* 화면은 로그아웃 */ }
    onLogout();
  }

  const selected = drafts?.find(d => d.id === selectedId) ?? null;
  const onSaved = useCallback((draft: Draft) => setDrafts(list => list?.map(d => (d.id === draft.id ? { ...draft, photo_count: draft.photo_count ?? d.photo_count } : d)).sort((a, b) => b.updated_at - a.updated_at) ?? null), []);
  const onPhotoCount = useCallback((n: number) => setDrafts(list => {
    if (!list || !selectedId) return list;
    const current = list.find(d => d.id === selectedId);
    return current && current.photo_count !== n ? list.map(d => (d.id === selectedId ? { ...d, photo_count: n } : d)) : list;
  }), [selectedId]);
  const onDeleted = useCallback((id: string) => { setDrafts(list => list?.filter(d => d.id !== id) ?? null); setSelectedId(null); }, []);

  return (
    <div className={`shell${selected || view !== 'drafts' ? ' editing' : ''}`}>
      <aside className="side" aria-label="원고 목록">
        <div className="brand"><Signature kind="minilog" word="log" size={17} tomong={32} /></div>
        <nav className="views" aria-label="미니로그 메뉴">
          {VIEWS.map(([key, label]) => (
            <button key={key} aria-current={view === key && (key !== 'drafts' || !selected)} onClick={() => { setView(key); if (key !== 'drafts') setSelectedId(null); }}>{label}</button>
          ))}
        </nav>
        <button className="btn primary" onClick={() => { void create(); }} disabled={creating}>{creating ? '만드는 중…' : '새 원고'}</button>
        {listError && <p className="error" role="alert">{listError}</p>}
        {drafts === null && !listError && <p className="muted small" role="status">불러오는 중…</p>}
        {drafts?.length === 0 && (
          <div className="list-empty">
            <Tomong kind="minilog" size={44} />
            <p className="muted small" style={{ margin: 0 }}>아직 원고가 없어요. <b>새 원고</b>로 시작하세요.</p>
          </div>
        )}
        {drafts && drafts.length > 0 && (
          <nav className="list" aria-label="원고">
            {drafts.map(d => (
              <button key={d.id} aria-current={d.id === selectedId} onClick={() => { setSelectedId(d.id); setView('drafts'); }}>
                <span className="t">{d.title.trim() || '제목 없는 원고'}</span>
                <span className="m">{STATUS_LABEL[d.status]}{d.photo_count ? ` · 사진 ${d.photo_count}` : ''} · {dateLabel(d.updated_at)}</span>
              </button>
            ))}
          </nav>
        )}
        <div className="side-foot">
          <a className="btn ghost small" href={APP_LINKS.hub}>미니허브</a>
          <span className="small muted">사용자 {me.user}</span>
          <button className="btn ghost small" onClick={logout}>로그아웃</button>
        </div>
      </aside>
      <main className="main">
        {view === 'style' ? <StylesView onBack={() => setView('drafts')} />
        : view === 'blog' ? <BlogView onBack={() => setView('drafts')} onOpenDraft={id => { setSelectedId(id); setView('drafts'); }} />
        : view === 'calendar' ? <CalendarView drafts={drafts ?? []} onBack={() => setView('drafts')} onOpenDraft={id => { setSelectedId(id); setView('drafts'); }} onCreate={date => { void create(date); }} />
        : view === 'dashboard' ? <DashboardView onBack={() => setView('drafts')} onOpen={id => { setSelectedId(id); setView('drafts'); }} onCampaigns={() => setView('campaigns')} />
        : view === 'campaigns' ? <CampaignsView drafts={drafts ?? []} onBack={() => setView('drafts')} onOpenDraft={id => { setSelectedId(id); setView('drafts'); }} />
        : selected
          ? <Editor key={selected.id} draft={selected} gemini={me.gemini.connected} onSaved={onSaved} onPhotoCount={onPhotoCount} onDeleted={onDeleted} onBack={() => setSelectedId(null)} />
          : (
            <div className="card empty">
              <Tomong kind="minilog" size={104} pose="wave" />
              <h1 style={{ margin: 0, fontSize: '1.35rem', letterSpacing: '-0.02em' }}>사진과 경험으로 블로그 원고 만들기</h1>
              <p className="hand empty-line">오늘은 어떤 이야기를 써 볼까요?</p>
              <p className="muted small" style={{ margin: 0 }}>왼쪽에서 원고를 고르거나 새 원고를 만드세요.</p>
              {!me.gemini.connected && <p className="error">Gemini 키가 아직 연결되지 않아 AI 초안은 만들 수 없어요. 원고 저장은 할 수 있어요.</p>}
            </div>
          )}
      </main>
    </div>
  );
}

type View = 'drafts' | 'calendar' | 'dashboard' | 'campaigns' | 'blog' | 'style';
const VIEWS: [View, string][] = [['drafts', '원고'], ['calendar', '캘린더'], ['dashboard', '대시보드'], ['campaigns', '협찬'], ['blog', '블로그'], ['style', '문체']];

interface Dashboard {
  since: string; gemini: { connected: boolean };
  ai: { calls: number; errors: number; input_tokens: number; output_tokens: number; tasks: { task: string; calls: number; tokens: number }[]; error_codes: { error_code: string; count: number }[] };
  drafts: { draft: number; approved: number; published: number; published_this_month: number };
  photos: { count: number; bytes: number; expiring: { id: string; title: string; count: number; expires_at: number }[] };
  top_posts: { title: string; url: string; views: number; likes: number | null }[];
  revenue: { this_month: number; months: { month: string; total: number; count: number }[]; pending: { total: number; count: number }; upcoming: { id: string; brand: string; title: string; deadline: string; status: CampaignStatus }[] };
}
const TASK_LABEL: Record<string, string> = { draft: '원고 초안', draft_with_photos: '사진 보고 초안', style: '내 문체 분석', style_reference: '참고 문체 분석' };
const ERROR_LABEL: Record<string, string> = { no_key: '키 없음', invalid_key: '키 오류', rate_limited: '호출 제한', quota_exceeded: '한도 초과', blocked: '안전 차단', bad_response: '응답 오류', upstream_error: 'Gemini 서버 오류', timeout: '시간 초과' };
const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}MB`;

function DashboardView({ onBack, onOpen, onCampaigns }: { onBack: () => void; onOpen: (id: string) => void; onCampaigns: () => void }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<Dashboard>('/api/dashboard').then(setData).catch(e => setError(e instanceof Error ? e.message : '불러오지 못했어요.'));
  }, []);
  const month = data ? new Date(data.since).getUTCMonth() + 1 : 0;
  const totalDrafts = data ? data.drafts.draft + data.drafts.approved + data.drafts.published : 0;
  return (
    <article className="stack" aria-labelledby="dash-title">
      <div className="editor-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn ghost back" onClick={onBack}>← 목록</button>
          <h1 id="dash-title" style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>내 대시보드</h1>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!data && !error && <p className="muted small" role="status">불러오는 중…</p>}
      {data && (
        <>
          <div className="kpis">
            <div className="card kpi"><span className="label">{month}월 게시한 글</span><span className="value">{formatNumber(data.drafts.published_this_month)}</span><span className="hint">전체 게시 {formatNumber(data.drafts.published)}</span></div>
            <div className="card kpi"><span className="label">{month}월 AI 호출</span><span className="value">{formatNumber(data.ai.calls)}</span><span className="hint">미니로그에서만</span></div>
            <div className="card kpi"><span className="label">{month}월 토큰</span><span className="value">{formatNumber(data.ai.input_tokens + data.ai.output_tokens)}</span><span className="hint">입력 {formatNumber(data.ai.input_tokens)} · 출력 {formatNumber(data.ai.output_tokens)}</span></div>
            <div className="card kpi"><span className="label">{month}월 오류</span><span className={`value${data.ai.errors ? ' off' : ''}`}>{formatNumber(data.ai.errors)}</span><span className="hint">{data.gemini.connected ? 'Gemini 연결됨' : 'Gemini 연결 안 됨'}</span></div>
          </div>

          <div className="dash-grid">
            <section className="card step" aria-labelledby="d-drafts">
              <h2 id="d-drafts" className="step-title">원고 현황<span className="step-sub">전체 {formatNumber(totalDrafts)}개</span></h2>
              {totalDrafts === 0 ? <p className="muted small" style={{ margin: 0 }}>아직 원고가 없어요.</p> : (
                <>
                  <div className="stack-bar" role="img" aria-label={`작성 중 ${data.drafts.draft}, 승인됨 ${data.drafts.approved}, 게시됨 ${data.drafts.published}`}>
                    <span className="s-draft" style={{ flexGrow: data.drafts.draft }} />
                    <span className="s-approved" style={{ flexGrow: data.drafts.approved }} />
                    <span className="s-published" style={{ flexGrow: data.drafts.published }} />
                  </div>
                  <ul className="legend-list">
                    <li><i className="s-draft" />작성 중 <b>{data.drafts.draft}</b></li>
                    <li><i className="s-approved" />승인됨 <b>{data.drafts.approved}</b></li>
                    <li><i className="s-published" />게시됨 <b>{data.drafts.published}</b></li>
                  </ul>
                </>
              )}
            </section>

            <section className="card step" aria-labelledby="d-photos">
              <h2 id="d-photos" className="step-title">사진 저장<span className="step-sub">{formatNumber(data.photos.count)}장 · {megabytes(data.photos.bytes)}</span></h2>
              {data.photos.expiring.length === 0 ? (
                <p className="muted small" style={{ margin: 0 }}>삭제 예정인 사진이 없어요. 게시 완료한 원고의 사진은 30일 뒤에 지워져요.</p>
              ) : (
                <ul className="expiring">
                  {data.photos.expiring.map(item => (
                    <li key={item.id}>
                      <button className="link-button" onClick={() => onOpen(item.id)}>{item.title.trim() || '제목 없는 원고'}</button>
                      <span className="muted small">사진 {item.count}장 · {dayLabel(item.expires_at)} 삭제</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card step" aria-labelledby="d-ai">
              <h2 id="d-ai" className="step-title">AI 작업별</h2>
              {data.ai.tasks.length === 0 ? <p className="muted small" style={{ margin: 0 }}>이번 달에는 아직 AI를 쓰지 않았어요.</p> : (
                <table className="mini-table">
                  <thead><tr><th scope="col">작업</th><th scope="col">호출</th><th scope="col">토큰</th></tr></thead>
                  <tbody>{data.ai.tasks.map(t => <tr key={t.task}><td>{TASK_LABEL[t.task] ?? t.task}</td><td>{formatNumber(t.calls)}</td><td>{formatNumber(t.tokens)}</td></tr>)}</tbody>
                </table>
              )}
              {data.ai.error_codes.length > 0 && (
                <p className="chips" aria-label="오류 종류">{data.ai.error_codes.map(e => <span key={e.error_code} className="chip warn">{ERROR_LABEL[e.error_code] ?? e.error_code} {e.count}</span>)}</p>
              )}
            </section>

            <section className="card step" aria-labelledby="d-top">
              <h2 id="d-top" className="step-title">조회수 TOP 3</h2>
              {data.top_posts.length === 0 ? (
                <p className="muted small" style={{ margin: 0 }}>블로그 탭에서 내 글을 가져오고 통계 캡처를 올리면 잘된 글이 여기에 보여요.</p>
              ) : (
                <ol className="top-posts">
                  {data.top_posts.map((p, i) => <li key={p.url}><span className="rank">{i + 1}</span><a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a><span className="muted small">조회 {formatNumber(p.views)}{p.likes !== null ? ` · 공감 ${formatNumber(p.likes)}` : ''}</span></li>)}
                </ol>
              )}
            </section>

            <section className="card step" aria-labelledby="d-revenue">
              <h2 id="d-revenue" className="step-title">협찬·광고 수익<span className="step-sub">받을 금액 {won(data.revenue.pending.total)} · {data.revenue.pending.count}건</span></h2>
              <p style={{ margin: 0 }}><span className="muted small">{month}월 받은 금액</span><br /><strong className="revenue-now">{won(data.revenue.this_month)}</strong></p>
              <div className="rev-bars" role="img" aria-label={data.revenue.months.map(m => `${Number(m.month.slice(5))}월 ${won(m.total)}`).join(', ')}>
                {data.revenue.months.map(m => {
                  const max = Math.max(1, ...data.revenue.months.map(x => x.total));
                  return (
                    <div key={m.month} className="rev-col">
                      <span className="rev-bar" style={{ height: `${Math.max(m.total ? 6 : 2, (m.total / max) * 100)}%` }} />
                      <span className="rev-label">{Number(m.month.slice(5))}월</span>
                    </div>
                  );
                })}
              </div>
              {data.revenue.upcoming.length > 0 && (
                <ul className="expiring">
                  {data.revenue.upcoming.map(u => (
                    <li key={u.id}><span><b>{u.brand}</b>{u.title && <span className="muted"> · {u.title}</span>}</span><span className="muted small">{CAMPAIGN_STATUS[u.status]} · 마감 {u.deadline.slice(5).replace('-', '/')} ({dDay(u.deadline)})</span></li>
                  ))}
                </ul>
              )}
              <button className="btn" style={{ justifySelf: 'start' }} onClick={onCampaigns}>협찬·수익 기록 보기</button>
            </section>
          </div>
        </>
      )}
    </article>
  );
}

interface StyleProfile { summary: string; tone: string; sentence: string; structure: string; expressions: string[]; emoji: string; hashtags: string }
interface Style { id: string; kind: 'mine' | 'reference'; name: string; source: string; samples: string[]; profile: StyleProfile | null; analyzed_at: number | null; updated_at: number }

/** 문체 목록: 내 문체 1개 + 참고 문체 여러 개. 하나를 골라 글을 넣고 분석한다. */
function StylesView({ onBack }: { onBack: () => void }) {
  const [styles, setStyles] = useState<Style[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSource, setNewSource] = useState('');
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    api<{ styles: Style[] }>('/api/styles')
      .then(data => { setStyles(data.styles); setSelectedId(data.styles[0]?.id ?? null); })
      .catch(error => setMessage({ kind: 'error', text: error instanceof Error ? error.message : '불러오지 못했어요.' }));
  }, []);

  async function addReference(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) { setMessage({ kind: 'error', text: '참고할 블로그 이름을 적어 주세요.' }); return; }
    try {
      const { style } = await api<{ style: Style }>('/api/styles', { body: { name: newName, source: newSource } });
      setStyles(list => [...(list ?? []), style]);
      setSelectedId(style.id);
      setAdding(false); setNewName(''); setNewSource(''); setMessage(null);
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : '추가하지 못했어요.' }); }
  }

  const replace = useCallback((style: Style) => setStyles(list => list?.map(s => (s.id === style.id ? style : s)) ?? null), []);
  const remove = useCallback((id: string) => { setStyles(list => list?.filter(s => s.id !== id) ?? null); setSelectedId(current => (current === id ? null : current)); }, []);
  const selected = styles?.find(s => s.id === selectedId) ?? null;

  return (
    <article className="stack" aria-labelledby="style-title">
      <div className="editor-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn ghost back" onClick={onBack}>← 목록</button>
          <h1 id="style-title" style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>문체</h1>
        </div>
      </div>
      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}
      {styles === null && !message && <p className="muted small" role="status">불러오는 중…</p>}
      {styles && (
        <div className="style-tabs" role="tablist" aria-label="문체 고르기">
          {styles.map(style => (
            <button key={style.id} role="tab" aria-selected={style.id === selectedId} onClick={() => setSelectedId(style.id)}>
              {style.kind === 'mine' ? '내 문체' : style.name}
              <span className={`dot${style.profile ? ' on' : ''}`} aria-label={style.profile ? '분석됨' : '분석 전'} />
            </button>
          ))}
          {styles.filter(s => s.kind === 'reference').length < 10 && (
            <button className="add" onClick={() => setAdding(v => !v)} aria-expanded={adding}>+ 참고 블로그</button>
          )}
        </div>
      )}
      {adding && (
        <form className="card step" onSubmit={addReference} aria-label="참고 블로그 추가">
          <p className="muted small" style={{ margin: 0 }}>따라 하고 싶은 블로거의 글을 붙여 넣으면 <b>쓰는 방식</b>(말투·문장 리듬·구성)만 정리해 참고해요. 그 사람의 문장이나 고유한 표현은 쓰지 않도록 AI에 안내해요.</p>
          <div className="field"><label htmlFor="ref-name">이름</label><input id="ref-name" className="input" value={newName} maxLength={40} placeholder="예: 동네맛집 블로거" onChange={e => setNewName(e.target.value)} /></div>
          <div className="field"><label htmlFor="ref-source">출처 메모(선택)</label><input id="ref-source" className="input" value={newSource} maxLength={300} placeholder="https://blog.naver.com/…" onChange={e => setNewSource(e.target.value)} /></div>
          <div className="ai-row"><button className="btn primary" type="submit">추가</button><button className="btn ghost" type="button" onClick={() => setAdding(false)}>취소</button></div>
        </form>
      )}
      {selected && <StyleEditor key={selected.id} style={selected} onChange={replace} onDeleted={remove} />}
    </article>
  );
}

function StyleEditor({ style, onChange, onDeleted }: { style: Style; onChange: (s: Style) => void; onDeleted: (id: string) => void }) {
  const [samples, setSamples] = useState<string[]>(style.samples.length ? style.samples : ['']);
  const [name, setName] = useState(style.name);
  const [source, setSource] = useState(style.source);
  const [busy, setBusy] = useState<'save' | 'analyze' | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const mine = style.kind === 'mine';
  const dirty = JSON.stringify(samples.map(x => x.trim()).filter(Boolean)) !== JSON.stringify(style.samples) || (!mine && (name.trim() !== style.name || source.trim() !== style.source));

  async function save() {
    setBusy('save'); setMessage(null);
    try {
      const { style: saved } = await api<{ style: Style }>(`/api/styles/${style.id}`, { method: 'PUT', body: mine ? { samples } : { samples, name, source } });
      onChange(saved); setSamples(saved.samples.length ? saved.samples : ['']); setName(saved.name); setSource(saved.source);
      setMessage({ kind: 'info', text: '저장했어요.' });
      return true;
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : '저장하지 못했어요.' }); return false; }
    finally { setBusy(null); }
  }

  async function analyze() {
    if (dirty && !(await save())) return;
    setBusy('analyze'); setMessage(null);
    try {
      const { style: saved } = await api<{ style: Style }>(`/api/styles/${style.id}/analyze`, { method: 'POST', body: {} });
      onChange(saved);
      setMessage({ kind: 'info', text: mine ? '문체를 정리했어요. AI 초안이 이 문체로 써요.' : '참고 문체를 정리했어요. 원고에서 이 문체를 고를 수 있어요.' });
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : '분석하지 못했어요.' }); }
    finally { setBusy(null); }
  }

  async function removeStyle() {
    if (!window.confirm(`'${style.name}' 참고 문체를 지울까요? 이 문체를 고른 원고는 내 문체로 바뀌어요.`)) return;
    try { await api(`/api/styles/${style.id}`, { method: 'DELETE' }); onDeleted(style.id); }
    catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : '지우지 못했어요.' }); }
  }

  const total = samples.reduce((n, x) => n + x.trim().length, 0);
  const profile = style.profile;
  return (
    <>
      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}
      <section className="card step" aria-labelledby="profile-title">
        <h2 id="profile-title" className="step-title">{mine ? '정리된 내 문체' : `정리된 참고 문체 · ${style.name}`}{style.analyzed_at ? <span className="step-sub">{dateLabel(style.analyzed_at)} 분석</span> : null}</h2>
        {profile ? (
          <div className="profile">
            <Tomong kind="minilog" size={56} />
            <div className="stack" style={{ gap: 10 }}>
              <p className="hand profile-summary">{profile.summary}</p>
              <dl className="kv">
                {profile.tone && <><dt>말투</dt><dd>{profile.tone}</dd></>}
                {profile.sentence && <><dt>문장</dt><dd>{profile.sentence}</dd></>}
                {profile.structure && <><dt>구성</dt><dd>{profile.structure}</dd></>}
                {profile.emoji && <><dt>이모티콘</dt><dd>{profile.emoji}</dd></>}
                {profile.hashtags && <><dt>해시태그</dt><dd>{profile.hashtags}</dd></>}
              </dl>
              {mine && profile.expressions.length > 0 && <p className="chips" aria-label="자주 쓰는 표현">{profile.expressions.map(x => <span key={x} className="chip">{x}</span>)}</p>}
              <p className="muted small" style={{ margin: 0 }}>{mine ? 'AI 초안을 만들 때 기본으로 이 문체를 따라 써요.' : '원고의 "어떤 문체로 쓸까요?"에서 고르면 쓰는 방식만 참고해요(문장·표현은 베끼지 않음).'}</p>
            </div>
          </div>
        ) : (
          <div className="profile">
            <Tomong kind="minilog" size={56} />
            <p className="muted small" style={{ margin: 0 }}>아직 정리하지 않았어요. 아래에 글을 붙여 넣고 <b>문체 분석하기</b>를 눌러 주세요.</p>
          </div>
        )}
      </section>

      <section className="card step" aria-labelledby="samples-title">
        <h2 id="samples-title" className="step-title">{mine ? '내가 예전에 쓴 글' : '참고할 글'}<span className="step-sub">{total.toLocaleString('ko-KR')}자 · {samples.filter(x => x.trim()).length}/5개</span></h2>
        {!mine && (
          <div className="ref-meta">
            <div className="field"><label htmlFor="ref-name-edit">이름</label><input id="ref-name-edit" className="input" value={name} maxLength={40} onChange={e => setName(e.target.value)} /></div>
            <div className="field"><label htmlFor="ref-source-edit">출처 메모</label><input id="ref-source-edit" className="input" value={source} maxLength={300} onChange={e => setSource(e.target.value)} /></div>
          </div>
        )}
        <p className="muted small" style={{ margin: 0 }}>
          {mine
            ? '내 블로그 글 1~5개를 그대로 복사해 붙여 넣어요(합쳐서 200자 이상). 글은 내 계정에만 저장되고 문체를 정리하는 데만 써요.'
            : '참고할 블로거의 글 1~5개를 붙여 넣어요(합쳐서 200자 이상). 내 계정에만 저장되고, 문체를 정리하는 데만 써요. 남의 글을 그대로 게시하면 저작권 문제가 될 수 있어요.'}
        </p>
        {samples.map((sample, index) => (
          <div className="field" key={index}>
            <div className="row-between">
              <label htmlFor={`sample-${index}`}>글 {index + 1}</label>
              {samples.length > 1 && <button className="btn ghost small" onClick={() => setSamples(list => list.filter((_, i) => i !== index))}>빼기</button>}
            </div>
            <textarea id={`sample-${index}`} className="textarea" value={sample} maxLength={8000} onChange={e => setSamples(list => list.map((x, i) => (i === index ? e.target.value : x)))} />
          </div>
        ))}
        <div className="ai-row">
          {samples.length < 5 && <button className="btn" onClick={() => setSamples(list => [...list, ''])}>글 하나 더</button>}
          <button className="btn" onClick={save} disabled={!dirty || busy !== null}>{busy === 'save' ? '저장하는 중…' : '저장'}</button>
          <button className="btn primary" onClick={analyze} disabled={busy !== null || total < 200}>{busy === 'analyze' ? '분석하는 중…' : '문체 분석하기'}</button>
          {!mine && <button className="btn ghost" onClick={removeStyle}>참고 문체 지우기</button>}
          {busy === 'analyze' && <span className="ai-busy" role="status"><Tomong kind="minilog" size={32} bounce /><span className="hand">토몽이가 글을 읽고 있어요</span></span>}
        </div>
      </section>
    </>
  );
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'failed';
type Fields = Pick<Draft, 'title' | 'body' | 'experience' | 'hashtags' | 'status' | 'style_id' | 'planned_on'>;

function Editor({ draft, gemini, onSaved, onPhotoCount, onDeleted, onBack }: {
  draft: Draft; gemini: boolean; onSaved: (d: Draft) => void; onPhotoCount: (n: number) => void; onDeleted: (id: string) => void; onBack: () => void;
}) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [storage, setStorage] = useState(true);
  const [uploading, setUploading] = useState(0);
  const [publishUrl, setPublishUrl] = useState(draft.published_url);
  const [published, setPublished] = useState({ url: draft.published_url, at: draft.published_at });
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    api<{ photos: Photo[]; storage: boolean }>(`/api/drafts/${draft.id}/photos`)
      .then(data => { if (alive) { setPhotos(data.photos); setStorage(data.storage); } })
      .catch(() => { if (alive) { setPhotos([]); setMessage({ kind: 'error', text: '사진 목록을 불러오지 못했어요.' }); } });
    return () => { alive = false; };
  }, [draft.id]);
  useEffect(() => { if (photos) onPhotoCount(photos.length); }, [photos, onPhotoCount]);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].slice(0, 20 - (photos?.length ?? 0));
    if (list.length < files.length) setMessage({ kind: 'error', text: '사진은 원고 하나에 20장까지예요. 넘는 사진은 빼고 올려요.' });
    else setMessage(null);
    setUploading(list.length);
    for (const file of list) {
      try {
        const photo = await uploadPhoto(draft.id, file);
        setPhotos(current => [...(current ?? []), photo]);
      } catch (error) {
        setMessage({ kind: 'error', text: error instanceof Error ? error.message : '사진을 올리지 못했어요.' });
      } finally {
        setUploading(n => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  /** 사진 순서가 바뀌면 본문의 [사진 n] 번호도 맞춘다(바뀐 게 있을 때만 저장). */
  function syncMarkers(before: Photo[], after: Photo[]) {
    const body = renumberMarkers(fields.body, before.map(p => p.id), after.map(p => p.id));
    if (body !== fields.body) change({ body });
  }

  async function removePhoto(photo: Photo, index: number) {
    if (!photos || !window.confirm(`사진 ${index + 1}을 지울까요? 본문의 [사진 ${index + 1}] 표시도 함께 지워요.`)) return;
    try {
      await api(`/api/photos/${photo.id}`, { method: 'DELETE' });
      const next = photos.filter(p => p.id !== photo.id);
      syncMarkers(photos, next);
      setPhotos(next);
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : '사진을 지우지 못했어요.' }); }
  }

  async function movePhoto(index: number, delta: -1 | 1) {
    if (!photos) return;
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    setPhotos(next);
    try {
      await api(`/api/drafts/${draft.id}/photos`, { method: 'PUT', body: { order: next.map(p => p.id) } });
      syncMarkers(photos, next);
    } catch (error) {
      setPhotos(photos);
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : '순서를 바꾸지 못했어요.' });
    }
  }

  async function setPublish(next: 'published' | 'approved') {
    await flush();
    try {
      const { draft: saved } = await api<{ draft: Draft }>(`/api/drafts/${draft.id}`, { method: 'PUT', body: next === 'published' ? { status: 'published', published_url: publishUrl } : { status: 'approved' } });
      setFields(current => ({ ...current, status: saved.status }));
      setPublished({ url: saved.published_url, at: saved.published_at });
      onSaved(saved);
      if (next === 'published') setPhotos(current => current?.map(p => ({ ...p, expires_at: (saved.published_at ?? Date.now()) + 30 * 86400000 })) ?? null);
      else setPhotos(current => current?.map(p => ({ ...p, expires_at: null })) ?? null);
      setMessage({ kind: 'info', text: next === 'published' ? '게시 완료로 기록했어요. 사진은 30일 뒤에 지워져요.' : '게시 기록을 취소했어요. 사진 삭제 예정도 취소했어요.' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : '게시 상태를 바꾸지 못했어요.' });
    }
  }
  const [fields, setFields] = useState<Fields>({ title: draft.title, body: draft.body, experience: draft.experience, hashtags: draft.hashtags, status: draft.status, style_id: draft.style_id, planned_on: draft.planned_on });
  const [styleOptions, setStyleOptions] = useState<Style[]>([]);
  useEffect(() => { api<{ styles: Style[] }>('/api/styles').then(d => setStyleOptions(d.styles)).catch(() => setStyleOptions([])); }, []);
  const [tagText, setTagText] = useState(draft.hashtags.map(t => `#${t}`).join(' '));
  const [save, setSave] = useState<SaveState>('saved');
  const [aiBusy, setAiBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const pending = useRef<Fields | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setSave('saving');
    try {
      const { draft: saved } = await api<{ draft: Draft }>(`/api/drafts/${draft.id}`, { method: 'PUT', body: next });
      onSaved(saved);
      setSave(pending.current ? 'dirty' : 'saved');
    } catch {
      pending.current = pending.current ?? next;
      setSave('failed');
    }
  }, [draft.id, onSaved]);

  // 자동 저장: 입력을 멈추고 0.8초 뒤. 화면을 떠날 때도 남은 것을 저장한다.
  function change(patch: Partial<Fields>) {
    setFields(current => {
      const next = { ...current, ...patch };
      pending.current = next;
      return next;
    });
    setSave('dirty');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, 800);
  }
  useEffect(() => () => { void flush(); }, [flush]);

  async function generate() {
    if (fields.experience.trim().length < 10) { setMessage({ kind: 'error', text: '실제 방문·사용 경험을 10자 이상 적어 주세요.' }); return; }
    if (fields.body.trim() && !window.confirm('지금 본문을 AI 초안으로 바꿀까요? 지금 내용은 사라져요.')) return;
    await flush();
    setAiBusy(true); setMessage(null);
    try {
      const { draft: made } = await api<{ draft: Draft }>(`/api/drafts/${draft.id}/generate`, { body: { experience: fields.experience } });
      setFields({ title: made.title, body: made.body, experience: made.experience, hashtags: made.hashtags, status: made.status, style_id: made.style_id, planned_on: made.planned_on });
      setTagText(made.hashtags.map(t => `#${t}`).join(' '));
      onSaved(made);
      setMessage({ kind: 'info', text: `AI 초안을 넣었어요${photos?.length ? `(사진 ${Math.min(photos.length, 8)}장 분석)` : ''}. [작성자 확인 필요] 표시가 있으면 꼭 고쳐 주세요.` });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'AI 초안을 만들지 못했어요.' });
    } finally { setAiBusy(false); }
  }

  async function copyPackage() {
    const text = `${fields.title}\n\n${fields.body}\n\n${fields.hashtags.map(t => `#${t}`).join(' ')}`.trim();
    try { await navigator.clipboard.writeText(text); setMessage({ kind: 'info', text: '제목·본문·해시태그를 복사했어요. 네이버 블로그 글쓰기에 붙여 넣으세요.' }); }
    catch { setMessage({ kind: 'error', text: '복사하지 못했어요. 본문을 직접 선택해 복사해 주세요.' }); }
  }

  async function remove() {
    if (!window.confirm('이 원고를 지울까요? 되돌릴 수 없어요.')) return;
    window.clearTimeout(timer.current);
    pending.current = null;
    try { await api(`/api/drafts/${draft.id}`, { method: 'DELETE' }); onDeleted(draft.id); }
    catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : '지우지 못했어요.' }); }
  }

  const saveLabel = { saved: '저장됨', dirty: '저장 대기', saving: '저장 중…', failed: '저장 실패' }[save];

  return (
    <article className="stack" aria-label="원고 편집">
      <div className="editor-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn ghost back" onClick={() => { void flush(); onBack(); }}>← 목록</button>
          <span className={`badge ${fields.status}`}>{STATUS_LABEL[fields.status]}</span>
          <span className={`save-state${save === 'failed' ? ' fail' : ''}`} role="status">{saveLabel}</span>
          {save === 'failed' && <button className="btn small" onClick={() => { void flush(); }}>다시 저장</button>}
        </div>
        <div className="actions">
          <button className="btn" onClick={copyPackage} disabled={!fields.title.trim() && !fields.body.trim()}>발행용 복사</button>
          {fields.status !== 'published' && (
            <button className="btn" onClick={() => change({ status: fields.status === 'approved' ? 'draft' : 'approved' })}>{fields.status === 'approved' ? '승인 취소' : '원고 승인'}</button>
          )}
          <button className="btn ghost" onClick={remove}>삭제</button>
        </div>
      </div>

      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}

      <section className="card step" aria-labelledby="s1">
        <h2 id="s1" className="step-title"><span className="n">1</span>사진<span className="step-sub">{photos ? `${photos.length}/20장` : ''}</span></h2>
        {!storage ? (
          <div className="dropzone small">사진 저장소(R2)가 아직 연결되지 않아 사진을 올릴 수 없어요.</div>
        ) : (
          <>
            {photos === null && <p className="muted small" role="status">사진을 불러오는 중…</p>}
            {photos && photos.length > 0 && (
              <ol className="photos" aria-label="올린 사진">
                {photos.map((photo, index) => (
                  <li key={photo.id} className="photo">
                    <a href={`/api/photos/${photo.id}`} target="_blank" rel="noopener"><img src={`/api/photos/${photo.id}`} alt={`사진 ${index + 1}: ${photo.name}`} loading="lazy" /></a>
                    <span className="photo-n">사진 {index + 1}</span>
                    <button className="photo-x" onClick={() => removePhoto(photo, index)} aria-label={`사진 ${index + 1} 지우기`}>×</button>
                    <span className="photo-move">
                      <button onClick={() => movePhoto(index, -1)} disabled={index === 0} aria-label={`사진 ${index + 1} 앞으로`}>‹</button>
                      <button onClick={() => movePhoto(index, 1)} disabled={index === photos.length - 1} aria-label={`사진 ${index + 1} 뒤로`}>›</button>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <label className={`dropzone pick${uploading ? ' busy' : ''}`}>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/*" multiple className="sr-only" onChange={e => { void addPhotos(e.target.files); }} disabled={uploading > 0 || (photos?.length ?? 0) >= 20} />
              {uploading > 0
                ? <span className="ai-busy" role="status"><Tomong kind="minilog" size={32} bounce /><span className="hand">사진 {uploading}장 올리는 중</span></span>
                : <span><b>사진 고르기</b> · 여러 장 한 번에 · 긴 변 1600px로 줄여서 올려요</span>}
            </label>
            {published.at && photos && photos.length > 0 && <p className="muted small" style={{ margin: 0 }}>게시 후 30일이 지나면 사진이 지워져요({dayLabel(published.at + 30 * 86400000)} 예정). 필요한 사진은 미리 받아 두세요.</p>}
          </>
        )}
      </section>

      <section className="card step" aria-labelledby="s2">
        <h2 id="s2" className="step-title"><span className="n">2</span>실제 방문·사용 경험</h2>
        {photos && photos.length > 0 && <p className="muted small" style={{ margin: 0 }}>AI가 사진 {Math.min(photos.length, 8)}장도 함께 보고 써요{photos.length > 8 ? '(앞의 8장까지)' : ''}.</p>}
        <div className="field">
          <label htmlFor="experience" className="small muted" style={{ fontWeight: 500 }}>언제·어디서·무엇을 했고 어땠는지 직접 겪은 내용을 적어 주세요. AI는 여기 적힌 것만 써요.</label>
          <textarea id="experience" className="textarea" value={fields.experience} maxLength={5000} onChange={e => change({ experience: e.target.value })} />
        </div>
        <div className="field style-pick">
          <label htmlFor="style-pick">어떤 문체로 쓸까요?</label>
          <select id="style-pick" className="input" value={fields.style_id} onChange={e => change({ style_id: e.target.value })}>
            <option value="mine">내 문체{styleOptions.find(s => s.kind === 'mine')?.profile ? '' : ' (아직 분석 전)'}</option>
            {styleOptions.filter(s => s.kind === 'reference').map(s => <option key={s.id} value={s.id}>참고: {s.name}{s.profile ? '' : ' (분석 전)'}</option>)}
            <option value="none">문체 없이</option>
          </select>
        </div>
        <div className="ai-row">
          <button className="btn primary" onClick={generate} disabled={aiBusy || !gemini}>
            {aiBusy ? 'AI가 쓰는 중…' : 'AI로 초안 만들기'}
          </button>
          {aiBusy && <span className="ai-busy" role="status"><Tomong kind="minilog" size={36} bounce /><span className="hand">토몽이가 열심히 쓰고 있어요</span></span>}
        </div>
        {!gemini && <p className="muted small" style={{ margin: 0 }}>Gemini 키가 연결되면 쓸 수 있어요(미니허브 설정 참고).</p>}
      </section>

      <section className="card step" aria-labelledby="s3">
        <h2 id="s3" className="step-title"><span className="n">3</span>원고</h2>
        <div className="field">
          <label htmlFor="title">제목</label>
          <input id="title" className="input title-input" value={fields.title} maxLength={200} onChange={e => change({ title: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="body">본문</label>
          <textarea id="body" className="textarea body-input" value={fields.body} maxLength={50000} onChange={e => change({ body: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="tags">해시태그</label>
          <input
            id="tags" className="input" value={tagText} placeholder="#맛집 #서울카페"
            onChange={e => { setTagText(e.target.value); change({ hashtags: e.target.value.split(/[\s,]+/).map(t => t.replace(/^#+/, '')).filter(Boolean).slice(0, 30) }); }}
          />
        </div>
      </section>

      <section className="card step" aria-labelledby="s4">
        <h2 id="s4" className="step-title"><span className="n">4</span>게시</h2>
        {fields.status === 'published' && published.url ? (
          <div className="published">
            <Tomong kind="minilog" size={44} pose="wave" />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700 }}>게시 완료{published.at ? ` · ${dayLabel(published.at)}` : ''}</p>
              <a className="small published-url" href={published.url} target="_blank" rel="noopener noreferrer">{published.url}</a>
            </div>
            <button className="btn ghost" onClick={() => { void setPublish('approved'); }}>게시 취소</button>
          </div>
        ) : (
          <>
            <div className="field" style={{ maxWidth: 240 }}>
              <label htmlFor="planned-on">게시 예정일(캘린더에 표시)</label>
              <input id="planned-on" className="input" type="date" value={fields.planned_on ?? ''} onChange={e => change({ planned_on: e.target.value || null })} />
            </div>
            <p className="muted small" style={{ margin: 0 }}>네이버 블로그에 올린 뒤 글 주소를 넣으면 게시 완료로 기록해요. 사진은 그로부터 30일 뒤에 지워져요.</p>
            <div className="publish-row">
              <label htmlFor="published-url" className="sr-only">게시한 글 주소</label>
              <input id="published-url" className="input" type="url" inputMode="url" placeholder="https://blog.naver.com/…" value={publishUrl} maxLength={500} onChange={e => setPublishUrl(e.target.value)} />
              <button className="btn primary" onClick={() => { void setPublish('published'); }} disabled={!publishUrl.trim()}>게시 완료</button>
            </div>
          </>
        )}
      </section>
    </article>
  );
}
