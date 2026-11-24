import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, APP_LABELS, APP_LINKS, formatNumber, type UsageRow } from '../../shared/client/api';
import { Tomong, Signature } from './Tomong';
import { Monthly } from './Monthly';
import { NamesContext, useNameOf } from './names';
import { applyTheme, type Theme } from '../../shared/client/theme';

interface Me {
  user: 'C' | 'D';
  name: string;
  theme: Theme;
  names: Record<string, string>;
  gemini: { connected: boolean };
  usage: { since: string; apps: UsageRow[] };
}

type State = { kind: 'loading' } | { kind: 'login' } | { kind: 'error'; message: string } | { kind: 'ready'; me: Me };

export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const me = await api<Me | { user: null }>('/api/me');
      if (me.user) applyTheme((me as Me).theme);
      setState(me.user ? { kind: 'ready', me: me as Me } : { kind: 'login' });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setState({ kind: 'login' });
      else setState({ kind: 'error', message: error instanceof Error ? error.message : '불러오지 못했어요.' });
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
  const me = state.me;
  return (
    <NamesContext.Provider value={me.names}>
      <Home me={me} onLogout={() => setState({ kind: 'login' })} onMe={next => setState({ kind: 'ready', me: { ...me, ...next, names: { ...me.names, [me.user]: next.name ?? me.name } } })} />
    </NamesContext.Provider>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) { setError('코드를 입력해 주세요.'); return; }
    setBusy(true);
    setError('');
    try {
      await api('/api/login', { body: { code } });
      setCode('');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <form className="card login stack" onSubmit={submit} noValidate>
        <div className="login-hero">
          <Tomong kind="hub" size={88} pose="wave" bounce />
          <h1 className="sr-only">미니허브 로그인</h1>
          <Signature kind="hub" word="hub" size={22} tomong={0} />
          <p className="hand login-line">코드를 입력해 주세요</p>
        </div>
        {/* 브라우저 비밀번호 저장(이 기기에 코드 기억)을 쓰도록: 숨은 사용자 칸 + 비밀번호 칸 */}
        <input type="text" name="username" autoComplete="username" value="minihub" readOnly hidden />
        <div className="field">
          <label htmlFor="code">로그인 코드</label>
          <div className="code-row">
            <input id="code" name="password" className="input" type={showCode ? 'text' : 'password'} value={code} onChange={e => setCode(e.target.value)} autoComplete="current-password" autoCapitalize="characters" spellCheck={false} aria-invalid={!!error} aria-describedby={error ? 'code-error' : 'code-help'} />
            <button type="button" className="btn ghost small" onClick={() => setShowCode(v => !v)} aria-pressed={showCode}>{showCode ? '숨기기' : '보기'}</button>
          </div>
          <p id="code-help" className="muted small" style={{ margin: 0 }}>브라우저가 "비밀번호 저장"을 물으면 저장하세요. 다음부터 이 기기에서 자동으로 채워져요. 한 번 로그인하면 쓰는 동안 계속 유지돼요.</p>
        </div>
        {error && <p id="code-error" className="error" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? '확인하는 중…' : '로그인'}</button>
      </form>
    </main>
  );
}

interface Overview {
  since: string;
  users: { user: string; gemini_connected: boolean }[];
  usage: (UsageRow & { user: string; model: string; task: string })[];
  errors: { app: string; error_code: string; count: number }[];
  minilog_published: { user: string; count: number }[];
  revenue: {
    month: string;
    months: { month: string; total: number }[];
    users: { user: string; this_month: number; open_count: number; open_total: number }[];
    upcoming: { user: string; brand: string; title: string; deadline: string; status: string; amount: number }[];
  };
}
const won = (n: number) => `${formatNumber(n)}원`;
const CAMPAIGN_STATUS: Record<string, string> = { proposed: '제안 받음', in_progress: '진행 중', posted: '게시 완료' };
function dDay(deadline: string) {
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const diff = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  return diff === 0 ? 'D-day' : `D-${diff}`;
}
type Scope = 'all' | 'me';
const SCOPE_KEY = 'minihub.scope';
function savedScope(): Scope {
  try { return localStorage.getItem(SCOPE_KEY) === 'me' ? 'me' : 'all'; } catch { return 'all'; }
}
const TASK_LABEL: Record<string, string> = { draft: '원고 초안', draft_with_photos: '사진 보고 초안', style: '문체 분석', style_reference: '참고 문체 분석', blog_stats: '통계 캡처 읽기', ideas: '글감 추천', ideas_search: '글감 추천(검색)', proposal: '제안서 초안', proposal_mail: '제안 메일 다듬기', proposal_dm: '인스타 DM 다듬기', instagram: '인스타 글 쓰기', note: '메모' };
const ERROR_LABEL: Record<string, string> = { no_key: '키 없음', invalid_key: '키 오류', rate_limited: '호출 제한', quota_exceeded: '한도 초과', blocked: '안전 차단', bad_response: '응답 오류', upstream_error: 'Gemini 서버 오류', timeout: '시간 초과' };

function sum<T>(rows: T[], pick: (row: T) => number) { return rows.reduce((n, row) => n + pick(row), 0); }

function OverviewPanel({ month }: { month: number }) {
  const nameOf = useNameOf();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<Overview>('/api/overview').then(setData).catch(e => setError(e instanceof Error ? e.message : '불러오지 못했어요.')); }, []);
  if (error) return <p className="error" role="alert">{error}</p>;
  if (!data) return <p className="muted small" role="status">전체 숫자를 불러오는 중…</p>;
  const tokens = (r: UsageRow) => r.input_tokens + r.output_tokens;
  const users = data.users.map(u => {
    const rows = data.usage.filter(r => r.user === u.user);
    const rev = data.revenue.users.find(r => r.user === u.user);
    return { ...u, calls: sum(rows, r => r.calls), tokens: sum(rows, tokens), errors: sum(rows, r => r.errors), published: data.minilog_published.find(p => p.user === u.user)?.count ?? 0, revenue: rev?.this_month ?? 0, openCount: rev?.open_count ?? 0, openTotal: rev?.open_total ?? 0 };
  });
  const apps = [...new Set(data.usage.map(r => r.app))].map(app => {
    const rows = data.usage.filter(r => r.app === app);
    return { app, calls: sum(rows, r => r.calls), errors: sum(rows, r => r.errors), input_tokens: sum(rows, r => r.input_tokens), output_tokens: sum(rows, r => r.output_tokens) };
  });
  const byModelTask = new Map<string, { model: string; task: string; calls: number; tokens: number }>();
  for (const r of data.usage) {
    const key = `${r.model}·${r.task}`;
    const cur = byModelTask.get(key) ?? { model: r.model, task: r.task, calls: 0, tokens: 0 };
    cur.calls += r.calls; cur.tokens += tokens(r);
    byModelTask.set(key, cur);
  }
  const errorCodes = new Map<string, number>();
  for (const e of data.errors) errorCodes.set(e.error_code, (errorCodes.get(e.error_code) ?? 0) + e.count);
  const total = { calls: sum(users, u => u.calls), tokens: sum(users, u => u.tokens), errors: sum(users, u => u.errors) };
  const maxUser = Math.max(1, ...users.map(u => u.tokens));
  const connected = users.filter(u => u.gemini_connected).length;
  return (
    <>
      <div className="kpis">
        <div className="card kpi"><span className="label">{month}월 전체 AI 호출</span><span className="value">{formatNumber(total.calls)}</span><span className="hint">{users.map(u => nameOf(u.user)).join('·')} 합계</span></div>
        <div className="card kpi"><span className="label">{month}월 전체 토큰</span><span className="value">{formatNumber(total.tokens)}</span><span className="hint">모든 앱</span></div>
        <div className="card kpi"><span className="label">{month}월 전체 오류</span><span className={`value${total.errors ? ' off' : ''}`}>{formatNumber(total.errors)}</span><span className="hint">호출 제한·키 오류 포함</span></div>
        <div className={`card kpi${connected === users.length ? ' sig' : ''}`}><span className="label">Gemini 연결</span><span className="value">{connected}/{users.length}</span><span className="hint">{users.filter(u => !u.gemini_connected).map(u => `${nameOf(u.user)} 연결 안 됨`).join(', ') || '모두 연결됨'}</span></div>
      </div>

      <section className="card" aria-labelledby="users-title">
        <h2 id="users-title" className="section-title">{month}월 사용자별</h2>
        <div className="user-rows">
          {users.map(u => (
            <div className="user-row" key={u.user}>
              <span className="avatar" aria-hidden="true">{u.user}</span>
              <div className="user-main">
                <div className="row"><b>{nameOf(u.user)}</b><span className={`badge ${u.gemini_connected ? 'ok' : 'off'}`}>{u.gemini_connected ? 'Gemini 연결됨' : '연결 안 됨'}</span></div>
                <div className="bar-track" role="img" aria-label={`토큰 ${formatNumber(u.tokens)}`}><span className="bar-in" style={{ width: `${(u.tokens / maxUser) * 100}%`, background: 'var(--sig)' }} /></div>
              </div>
              <dl className="user-nums">
                <div><dt>호출</dt><dd>{formatNumber(u.calls)}</dd></div>
                <div><dt>토큰</dt><dd>{formatNumber(u.tokens)}</dd></div>
                <div><dt>오류</dt><dd>{formatNumber(u.errors)}</dd></div>
                <div><dt>게시 글</dt><dd>{formatNumber(u.published)}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="revenue-title">
        <h2 id="revenue-title" className="section-title">협찬·광고 수익</h2>
        <div className="rev-grid">
          <div>
            <div className="totals">
              <div><span className="muted small">{month}월 받은 금액(합계)</span><strong>{won(sum(users, u => u.revenue))}</strong></div>
              <div><span className="muted small">받을 금액</span><strong>{won(sum(users, u => u.openTotal))}</strong></div>
              <div><span className="muted small">진행 중</span><strong>{formatNumber(sum(users, u => u.openCount))}건</strong></div>
            </div>
            <table className="usage">
              <thead><tr><th scope="col">사용자</th><th scope="col">{month}월 받은 금액</th><th scope="col">받을 금액</th><th scope="col">진행 중</th></tr></thead>
              <tbody>{users.map(u => <tr key={u.user}><td>{u.user}</td><td>{won(u.revenue)}</td><td>{won(u.openTotal)}</td><td>{formatNumber(u.openCount)}건</td></tr>)}</tbody>
            </table>
          </div>
          <div>
            {data.revenue.months.some(m => m.total > 0) ? (
            <div className="rev-bars" role="img" aria-label={data.revenue.months.map(m => `${Number(m.month.slice(5))}월 ${won(m.total)}`).join(', ')}>
              {data.revenue.months.map(m => {
                const max = Math.max(1, ...data.revenue.months.map(x => x.total));
                return <div key={m.month} className="rev-col"><span className="rev-bar" style={{ height: `${Math.max(m.total ? 6 : 2, (m.total / max) * 100)}%` }} /><span className="rev-label">{Number(m.month.slice(5))}월</span></div>;
              })}
            </div>
            ) : <p className="muted small" style={{ margin: 0 }}>최근 6개월 받은 금액이 아직 없어요.</p>}
          </div>
        </div>
        {data.revenue.upcoming.length > 0 ? (
          <ul className="upcoming">
            {data.revenue.upcoming.map((c, i) => (
              <li key={`${c.user}${c.deadline}${i}`}>
                <span className="avatar small-avatar" aria-label={nameOf(c.user)}>{c.user}</span>
                <span className="up-main"><b>{c.brand}</b>{c.title && <span className="muted"> · {c.title}</span>}</span>
                <span className="muted small">{CAMPAIGN_STATUS[c.status] ?? c.status} · {c.deadline.slice(5).replace('-', '/')} ({dDay(c.deadline)})</span>
                <span className="up-amount">{c.amount ? won(c.amount) : ''}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted small" style={{ margin: '12px 0 0' }}>다가오는 협찬 마감이 없어요.</p>}
      </section>

      <div className="settings">
        <section className="card" aria-labelledby="apps-usage-title">
          <h2 id="apps-usage-title" className="section-title">앱별</h2>
          {apps.length === 0 ? <p className="muted small" style={{ margin: 0 }}>이번 달에는 아직 AI를 쓰지 않았어요.</p> : (
            <div className="bars">
              {apps.map(row => (
                <div className={`bar-row ${row.app}`} key={row.app}>
                  <span>{APP_LABELS[row.app] ?? row.app}</span>
                  <div className="bar-track" role="img" aria-label={`호출 ${row.calls}, 토큰 ${formatNumber(tokens(row))}`}>
                    <span className="bar-in" style={{ width: `${(tokens(row) / Math.max(1, ...apps.map(tokens))) * 100}%` }} />
                  </div>
                  <span className="bar-num">{formatNumber(tokens(row))}</span>
                </div>
              ))}
            </div>
          )}
          {errorCodes.size > 0 && <p className="chips" aria-label="오류 종류">{[...errorCodes].map(([code, n]) => <span key={code} className="chip warn">{ERROR_LABEL[code] ?? code} {n}</span>)}</p>}
        </section>
        <section className="card" aria-labelledby="model-title">
          <h2 id="model-title" className="section-title">모델·작업별</h2>
          {byModelTask.size === 0 ? <p className="muted small" style={{ margin: 0 }}>기록이 없어요.</p> : (
            <div className="table-wrap">
              <table className="usage">
                <thead><tr><th scope="col">모델</th><th scope="col">작업</th><th scope="col">호출</th><th scope="col">토큰</th></tr></thead>
                <tbody>{[...byModelTask.values()].map(r => <tr key={`${r.model}${r.task}`}><td>{r.model}</td><td>{TASK_LABEL[r.task] ?? r.task}</td><td>{formatNumber(r.calls)}</td><td>{formatNumber(r.tokens)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

const APPS = [
  { id: 'minially', kind: 'minially', word: 'ally', name: '미니어리', desc: '일정·할 일·메모', href: APP_LINKS.minially },
  { id: 'minilog', kind: 'minilog', word: 'log', name: '미니로그', desc: '사진으로 블로그 원고 만들기', href: APP_LINKS.minilog },
] as const;

function Home({ me, onLogout, onMe }: { me: Me; onLogout: () => void; onMe: (next: Partial<Pick<Me, 'name' | 'theme'>>) => void }) {
  const [busy, setBusy] = useState(false);
  const [scope, setScopeState] = useState<Scope>(savedScope);
  const setScope = (next: Scope) => { setScopeState(next); try { localStorage.setItem(SCOPE_KEY, next); } catch { /* 저장 못 해도 화면은 바뀜 */ } };
  const byApp = new Map(me.usage.apps.map(row => [row.app, row]));
  const totals = me.usage.apps.reduce(
    (sum, row) => ({ calls: sum.calls + row.calls, errors: sum.errors + row.errors, input: sum.input + row.input_tokens, output: sum.output + row.output_tokens }),
    { calls: 0, errors: 0, input: 0, output: 0 },
  );
  const month = new Date(me.usage.since).getUTCMonth() + 1;
  const today = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
  const maxTokens = Math.max(1, ...me.usage.apps.map(row => row.input_tokens + row.output_tokens));
  const line = !me.gemini.connected
    ? 'Gemini를 연결하면 같이 일할 수 있어요'
    : totals.calls > 0 ? `이번 달 AI랑 ${formatNumber(totals.calls)}번 같이 일했어요` : '이번 달은 아직 AI를 안 썼어요';

  async function logout() {
    setBusy(true);
    try { await api('/api/logout', { method: 'POST', body: {} }); } catch { /* 서버가 안 받아도 화면은 로그아웃 */ }
    onLogout();
  }

  return (
    <div className="shell">
      <aside className="side" aria-label="메뉴">
        <a className="brand" href="#overview" aria-label="미니허브 처음으로"><Signature kind="hub" word="hub" size={17} tomong={32} /></a>
        <nav className="nav-wrap" aria-label="미니허브 메뉴">
          <div className="nav">
            <a href="#overview">대시보드</a>
            <a href="#monthly">월간 보고</a>
            <a href="#apps">앱</a>
            {/* 'AI 사용량'은 내 대시보드의 사용량 칸으로(통합 화면이면 잠깐 내 대시보드로 바꿔 보여 줌, 기본 보기 설정은 그대로) */}
            <a href="#usage" onClick={event => { event.preventDefault(); setScopeState('me'); window.setTimeout(() => document.getElementById('usage')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>AI 사용량</a>
            <a href="#settings">설정</a>
          </div>
          <div className="nav-label">바로 가기</div>
          <div className="nav">
            {APPS.map(app => (
              <a key={app.id} href={app.href}><span className="nav-app"><Tomong kind={app.kind} size={20} />{app.name}</span><span className="ext" aria-hidden="true">↗</span></a>
            ))}
          </div>
        </nav>
        <div className="side-foot">
          <div className="who">
            <span className="avatar" aria-hidden="true">{me.user}</span>
            <span className="who-text small">{me.name}</span>
          </div>
          <button className="btn ghost small" onClick={logout} disabled={busy}>로그아웃</button>
        </div>
      </aside>

      <main className="main">
        <section id="overview" className="stack" aria-labelledby="hello-title">
          <div className="card hello">
            <Tomong kind="hub" size={76} pose="wave" />
            <div>
              <h1 id="hello-title">{me.name === `사용자 ${me.user}` ? me.user : me.name}님, 오늘도 반가워요</h1>
              <p className="hand hello-line">{line}</p>
              <p className="muted small" style={{ margin: 0 }}>{today}</p>
            </div>
          </div>
          <div className="scope" role="group" aria-label="대시보드 보기">
            <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>통합 대시보드</button>
            <button aria-pressed={scope === 'me'} onClick={() => setScope('me')}>내 대시보드</button>
          </div>
          {scope === 'all' ? <OverviewPanel month={month} /> : (
          <div className="kpis">
            <div className="card kpi">
              <span className="label">{month}월 AI 호출</span>
              <span className="value">{formatNumber(totals.calls)}</span>
              <span className="hint">모든 앱 합계</span>
            </div>
            <div className="card kpi">
              <span className="label">{month}월 토큰</span>
              <span className="value">{formatNumber(totals.input + totals.output)}</span>
              <span className="hint">입력 {formatNumber(totals.input)} · 출력 {formatNumber(totals.output)}</span>
            </div>
            <div className="card kpi">
              <span className="label">{month}월 오류</span>
              <span className={`value${totals.errors > 0 ? ' off' : ''}`}>{formatNumber(totals.errors)}</span>
              <span className="hint">호출 제한·키 오류 포함</span>
            </div>
            <div className={`card kpi${me.gemini.connected ? ' sig' : ''}`}>
              <span className="label">Gemini</span>
              <span className={`value ${me.gemini.connected ? 'ok' : 'off'}`}>{me.gemini.connected ? '연결됨' : '연결 안 됨'}</span>
              <span className="hint">{me.gemini.connected ? `${me.name}의 키` : <a href="#settings">연결 방법 보기</a>}</span>
            </div>
          </div>
          )}
        </section>

        <Monthly />

        <section id="apps" aria-labelledby="apps-title">
          <h2 id="apps-title" className="section-title">앱</h2>
          <div className="apps">
            {APPS.map(app => {
              const row = byApp.get(app.id);
              return (
                <article key={app.id} className={`card app-card ${app.id}`}>
                  <Tomong kind={app.kind} size={64} />
                  <div className="app-info">
                    <h3><Signature kind={app.kind} word={app.word} size={17} tomong={0} /><span className="sr-only">{app.name}</span></h3>
                    <p>{app.name} · {app.desc}</p>
                    <div className="app-stats">
                      <span>내 AI 호출 <strong>{formatNumber(row?.calls ?? 0)}</strong></span>
                      <span>내 토큰 <strong>{formatNumber((row?.input_tokens ?? 0) + (row?.output_tokens ?? 0))}</strong></span>
                    </div>
                  </div>
                  <a className="btn primary" href={app.href}>{app.name} 열기</a>
                </article>
              );
            })}
          </div>
        </section>

        {scope === 'me' && <section id="usage" className="card" aria-labelledby="usage-title">
          <h2 id="usage-title" className="section-title">{month}월 내 앱별 AI 사용량</h2>
          {me.usage.apps.length === 0 ? (
            <div className="empty-usage">
              <Tomong kind="hub" size={48} />
              <p className="muted small" style={{ margin: 0 }}>이번 달에는 아직 AI를 쓰지 않았어요. 미니로그에서 원고를 만들면 여기에 쌓여요.</p>
            </div>
          ) : (
            <>
              <div className="legend" aria-hidden="true"><span className="in">입력 토큰</span><span className="out">출력 토큰</span></div>
              <div className="bars">
                {me.usage.apps.map(row => (
                  <div className={`bar-row ${row.app}`} key={row.app}>
                    <span>{APP_LABELS[row.app] ?? row.app}</span>
                    <div className="bar-track" role="img" aria-label={`입력 ${formatNumber(row.input_tokens)}, 출력 ${formatNumber(row.output_tokens)} 토큰`}>
                      <span className="bar-in" style={{ width: `${(row.input_tokens / maxTokens) * 100}%` }} />
                      <span className="bar-out" style={{ width: `${(row.output_tokens / maxTokens) * 100}%` }} />
                    </div>
                    <span className="bar-num">{formatNumber(row.input_tokens + row.output_tokens)}</span>
                  </div>
                ))}
              </div>
              <div className="table-wrap">
                <table className="usage">
                  <thead><tr><th scope="col">앱</th><th scope="col">호출</th><th scope="col">입력 토큰</th><th scope="col">출력 토큰</th><th scope="col">오류</th></tr></thead>
                  <tbody>
                    {me.usage.apps.map(row => (
                      <tr key={row.app}>
                        <td>{APP_LABELS[row.app] ?? row.app}</td>
                        <td>{formatNumber(row.calls)}</td>
                        <td>{formatNumber(row.input_tokens)}</td>
                        <td>{formatNumber(row.output_tokens)}</td>
                        <td>{formatNumber(row.errors)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>}

        <section id="settings" aria-labelledby="settings-title">
          <h2 id="settings-title" className="section-title">설정</h2>
          <div className="settings">
            <SettingsCard me={me} scope={scope} setScope={setScope} onMe={onMe} />
            <div className="card">
              <h3 className="section-title" style={{ fontSize: '0.95rem' }}>Gemini 키</h3>
              {me.gemini.connected ? (
                <p className="muted small" style={{ margin: 0 }}>{me.name}의 키가 서버 비밀값으로 등록돼 있어요. hub와 mini-log가 함께 써요. 키를 바꾸려면 Cloudflare에서 <code>GEMINI_KEY_{me.user}</code> 값을 바꾸세요.</p>
              ) : (
                <>
                  <p className="muted small" style={{ margin: 0 }}>키는 보안을 위해 이 화면이 아니라 Cloudflare 비밀값으로 등록해요.</p>
                  <ol className="help small muted">
                    <li>Cloudflare → minihub·mini-log 프로젝트 → Settings → Variables and Secrets</li>
                    <li>비밀값 이름 <code>GEMINI_KEY_{me.user}</code>, 값에 Gemini API 키</li>
                    <li>저장한 뒤 다시 배포하면 연결돼요</li>
                  </ol>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// 설정: 이름 바꾸기(두 앱에 보임), 화면 테마(두 앱, 서버에 저장), 처음 볼 대시보드(이 기기)
function SettingsCard({ me, scope, setScope, onMe }: { me: Me; scope: Scope; setScope: (s: Scope) => void; onMe: (next: Partial<Pick<Me, 'name' | 'theme'>>) => void }) {
  const [name, setName] = useState(me.name);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(patch: { name?: string; theme?: Theme }) {
    setBusy(true); setMessage(null);
    try {
      const { profile } = await api<{ profile: { name: string; theme: Theme } }>('/api/settings', { method: 'PUT', body: patch });
      if (patch.theme) applyTheme(profile.theme);
      onMe(profile);
      setName(profile.name);
      setMessage({ kind: 'info', text: patch.name ? '이름을 바꿨어요. mini-log에도 이 이름으로 보여요.' : '화면 테마를 바꿨어요. mini-log에도 적용돼요.' });
    } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '저장하지 못했어요.' }); }
    finally { setBusy(false); }
  }

  return (
    <div className="card settings-card">
      <h3 className="section-title" style={{ fontSize: '0.95rem' }}>내 설정</h3>
      <form className="setting" onSubmit={e => { e.preventDefault(); void save({ name }); }}>
        <label htmlFor="my-name">이름</label>
        <div className="code-row">
          <input id="my-name" className="input" value={name} maxLength={20} autoComplete="nickname" onChange={e => setName(e.target.value)} />
          <button className="btn small" type="submit" disabled={busy || !name.trim() || name.trim() === me.name}>이름 바꾸기</button>
        </div>
        <span className="muted small">대시보드·월간 보고·mini-log에 보이는 이름이에요. 로그인 코드는 그대로예요.</span>
      </form>
      <div className="setting" role="group" aria-labelledby="theme-label">
        <span id="theme-label" className="setting-label">화면 테마</span>
        <div className="seg">
          {([['auto', '기기 설정 따라'], ['light', '밝게'], ['dark', '어둡게']] as [Theme, string][]).map(([t, label]) => (
            <button key={t} type="button" aria-pressed={me.theme === t} disabled={busy} onClick={() => { void save({ theme: t }); }}>{label}</button>
          ))}
        </div>
      </div>
      <div className="setting" role="group" aria-labelledby="scope-label">
        <span id="scope-label" className="setting-label">처음 볼 대시보드<span className="muted small"> · 이 기기</span></span>
        <div className="seg">
          <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>통합</button>
          <button type="button" aria-pressed={scope === 'me'} onClick={() => setScope('me')}>내 것만</button>
        </div>
      </div>
      <dl className="kv">
        <dt>사용자</dt><dd>{me.user}</dd>
        <dt>로그인</dt><dd>공유 코드</dd>
        <dt>로그인 유지</dt><dd>쓰는 동안 계속(30일 동안 안 쓰면 다시 로그인)</dd>
      </dl>
      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}
    </div>
  );
}
