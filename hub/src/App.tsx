import { useCallback, useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { NavIcon } from './NavIcon';
import { CommandPalette, openPalette, type Command } from './CommandPalette';
import { Skeleton } from './Skeleton';
import { BarList, Columns, Donut } from './Charts';
import { AI_ERROR_LABEL, AI_TASK_LABEL } from '../../shared/client/aiLabels';
import { api, ApiError, APP_LABELS, APP_LINKS, formatNumber, type UsageRow } from '../../shared/client/api';
import { Tomong, Signature } from './Tomong';
import { Monthly } from './Monthly';
import { AccountsPanel } from './Accounts';
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

  if (state.kind === 'loading') return <main className="page"><Skeleton rows={2} /></main>;
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
  /** 이번 주(월~일, 한국 시간) 게시 글 수 */
  minilog_week?: { user: string; count: number }[];
  /** 이번 달 다른 곳(인스타·스레드·X)에 올렸다고 체크한 수 */
  minilog_shares?: { user: string; count: number }[];
  /** 미니로그 글 종류별 원고 수(계정 기반, 많은 순) */
  minilog_types?: { user: string; type: string; label: string; count: number }[];
  /** 오늘(한국 시간) 사람·모델별 Gemini 호출 수와 한도 오류 수 */
  today?: { user: string; model: string; calls: number; limited: number }[];
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
// 메뉴 4개(넓은 화면 옆 메뉴 '보기·관리'와 휴대폰 아래 탭이 같음)
const NAV_MAIN = [{ id: 'overview', label: '대시보드' }, { id: 'monthly', label: '월간 보고' }, { id: 'apps', label: '앱 연결' }, { id: 'usage', label: 'AI 사용량' }];
const NAV_IDS = [...NAV_MAIN.map(n => n.id), 'settings'];
const SCOPE_KEY = 'minihub.scope';
function savedScope(): Scope {
  try { return localStorage.getItem(SCOPE_KEY) === 'me' ? 'me' : 'all'; } catch { return 'all'; }
}

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
    return { ...u, calls: sum(rows, r => r.calls), tokens: sum(rows, tokens), errors: sum(rows, r => r.errors), published: data.minilog_published.find(p => p.user === u.user)?.count ?? 0, week: data.minilog_week?.find(p => p.user === u.user)?.count ?? 0, shares: data.minilog_shares?.find(p => p.user === u.user)?.count ?? 0, types: (data.minilog_types ?? []).filter(t => t.user === u.user).slice(0, 3), revenue: rev?.this_month ?? 0, openCount: rev?.open_count ?? 0, openTotal: rev?.open_total ?? 0 };
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
  const connected = users.filter(u => u.gemini_connected).length;
  const fixes = [
    ...users.filter(u => !u.gemini_connected).map(u => ({ text: `${nameOf(u.user)} Gemini 연결 안 됨`, href: '#settings', link: '연결 방법' })),
    ...users.filter(u => u.errors > 0).map(u => ({ text: `${nameOf(u.user)} 이번 달 AI 오류 ${formatNumber(u.errors)}번`, href: '', link: '' })),
  ];
  return (
    <>
      <div className="kpis">
        {/* 앞에는 글·돈(하는 일), AI 숫자는 한 칸으로(토큰·오류는 작은 글씨) */}
        <div className="card kpi"><span className="label">{month}월 게시 글</span><span className="value">{formatNumber(sum(users, u => u.published))}개</span><span className="hint">이번 주 {formatNumber(sum(users, u => u.week))}편 · {users.map(u => nameOf(u.user)).join('·')} 합계</span></div>
        <div className="card kpi"><span className="label">{month}월 받은 금액</span><span className="value">{won(sum(users, u => u.revenue))}</span><span className="hint">받을 금액 {won(sum(users, u => u.openTotal))}</span></div>
        <div className="card kpi"><span className="label">{month}월 전체 AI 호출</span><span className="value">{formatNumber(total.calls)}</span><span className={`hint${total.errors ? ' off' : ''}`}>토큰 {formatNumber(total.tokens)} · 오류 {formatNumber(total.errors)}</span></div>
        <div className={`card kpi${connected === users.length ? ' sig' : ''}`}><span className="label">Gemini 연결</span><span className="value">{connected}/{users.length}</span><span className="hint">{users.filter(u => !u.gemini_connected).map(u => `${nameOf(u.user)} 연결 안 됨`).join(', ') || '모두 연결됨'}</span></div>
      </div>

      {/* 손볼 것: 연결 안 된 키·이번 달 오류를 맨 위에(없으면 한 줄로 괜찮다고) */}
      <div className={`card fixit${fixes.length ? '' : ' fine'}`} role="status" aria-label="손볼 것">
        <b>{fixes.length ? `손볼 것 ${fixes.length}개` : '손볼 것 없음'}</b>
        {fixes.length ? <ul>{fixes.map(f => <li key={f.text}>{f.text}{f.href && <> · <a href={f.href}>{f.link}</a></>}</li>)}</ul> : <span className="muted small">두 사람 모두 연결돼 있고 이번 달 오류가 없어요.</span>}
      </div>

      <section className="card" aria-labelledby="users-title">
        <h2 id="users-title" className="section-title">{month}월 사용자별</h2>
        {total.tokens > 0 && <Donut label="사용자별 토큰" sub="토큰" size={96} slices={users.map((u, i) => ({ label: nameOf(u.user), value: u.tokens, color: USER_COLORS[i % USER_COLORS.length] }))} />}
        {/* 한 줄 비교 표: 숫자가 줄바꿈되지 않게 사람마다 한 줄, 휴대폰에서는 사람마다 카드 */}
        <div className="table-wrap">
          <table className="people" aria-label={`${month}월 사람별 숫자`}>
            <thead><tr><th scope="col">사람</th><th scope="col">게시 글</th><th scope="col">이번 주</th><th scope="col">다른 곳 공유</th><th scope="col">받은 금액</th><th scope="col">AI 호출</th><th scope="col">토큰</th><th scope="col">오류</th><th scope="col">자주 쓰는 글</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr className="user-row" key={u.user}>
                  <th scope="row"><span className="who-cell"><span className="avatar" aria-hidden="true">{u.user}</span><b>{nameOf(u.user)}</b><span className={`badge ${u.gemini_connected ? 'ok' : 'off'}`}>{u.gemini_connected ? 'Gemini 연결됨' : '연결 안 됨'}</span></span></th>
                  <td data-col="published" data-label="게시 글">{formatNumber(u.published)}</td>
                  <td data-col="week" data-label="이번 주" title="이번 주 게시 글(권장 3~5편)">{formatNumber(u.week)}편</td>
                  <td data-col="shares" data-label="다른 곳 공유" title="이번 달 인스타·스레드·X에 올렸다고 체크한 수">{formatNumber(u.shares)}</td>
                  <td data-col="revenue" data-label="받은 금액">{won(u.revenue)}</td>
                  <td data-col="calls" data-label="AI 호출">{formatNumber(u.calls)}</td>
                  <td data-col="tokens" data-label="토큰">{formatNumber(u.tokens)}</td>
                  <td data-col="errors" data-label="오류" className={u.errors ? 'off' : undefined}>{formatNumber(u.errors)}</td>
                  <td data-col="types" data-label="자주 쓰는 글"><span className="user-types small" aria-label={`${nameOf(u.user)} 자주 쓰는 글 종류`}>{u.types.length ? u.types.map(t => <span key={t.type} className="type-chip">{t.label} {formatNumber(t.count)}</span>) : <span className="muted">아직 없음</span>}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="today-title">
        <h2 id="today-title" className="section-title">오늘 Gemini 사용(한국 시간 0시부터)</h2>
        <p className="muted small" style={{ marginTop: 0 }}>무료 등급은 모델마다 하루 호출 수 한도가 있어요. 미니로그 초안과 미니어리 사진 읽기가 같은 사람의 키를 나눠 써요. 정확한 한도는 Google AI Studio에서 확인하세요.</p>
        {(data.today ?? []).length === 0 ? <p className="muted small" style={{ margin: 0 }}>오늘은 아직 AI를 쓰지 않았어요.</p> : (
          <div className="table-wrap">
            <table className="usage" aria-label="오늘 사람·모델별 Gemini 사용">
              <thead><tr><th scope="col">사람</th><th scope="col">모델</th><th scope="col">호출</th><th scope="col">한도 오류</th></tr></thead>
              <tbody>
                {(data.today ?? []).map(r => (
                  <tr key={`${r.user}-${r.model}`}>
                    <td>{nameOf(r.user)}</td>
                    <td>{r.model}</td>
                    <td>{formatNumber(r.calls)}</td>
                    <td className={r.limited ? 'off' : ''}>{r.limited ? `${formatNumber(r.limited)}번 (한도에 걸림)` : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
            <Donut label="사용자별 이번 달 받은 금액" format={shortWon} slices={users.map((u, i) => ({ label: nameOf(u.user), value: u.revenue, color: USER_COLORS[i % USER_COLORS.length] }))} />
          </div>
          <div>
            {data.revenue.months.some(m => m.total > 0) ? (
            <Columns label="최근 6개월 받은 금액" items={data.revenue.months.map(m => ({ label: `${Number(m.month.slice(5))}월`, value: m.total }))} format={shortWon} />
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
          {errorCodes.size > 0 && <p className="chips" aria-label="오류 종류">{[...errorCodes].map(([code, n]) => <span key={code} className="chip warn">{AI_ERROR_LABEL[code] ?? code} {n}</span>)}</p>}
        </section>
        <section className="card" aria-labelledby="model-title">
          <h2 id="model-title" className="section-title">모델·작업별</h2>
          {byModelTask.size === 0 ? <p className="muted small" style={{ margin: 0 }}>기록이 없어요.</p> : (<>
            <BarList label="작업별 토큰" items={byTask(byModelTask)} />
            <details className="more-table">
              <summary>모델별 표로 보기</summary>
              <div className="table-wrap">
                <table className="usage">
                  <thead><tr><th scope="col">모델</th><th scope="col">작업</th><th scope="col">호출</th><th scope="col">토큰</th></tr></thead>
                  <tbody>{[...byModelTask.values()].map(r => <tr key={`${r.model}${r.task}`}><td>{r.model}</td><td>{AI_TASK_LABEL[r.task] ?? r.task}</td><td>{formatNumber(r.calls)}</td><td>{formatNumber(r.tokens)}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
          </>)}
        </section>
      </div>
    </>
  );
}

/** 사용자 색(C·D…): 서명 색과 보조 색 */
const USER_COLORS = ['var(--sig)', '#7C8CE0', '#3FAE8B'];
/** 그래프 위 짧은 금액: 12,000 → 1.2만원 */
const shortWon = (n: number) => (n >= 10000 ? `${Math.round(n / 1000) / 10}만원` : `${formatNumber(n)}원`);
/** 모델·작업 표 → 작업별 합계(토큰 많은 순) */
function byTask(rows: Map<string, { task: string; calls: number; tokens: number }>) {
  const map = new Map<string, { calls: number; tokens: number }>();
  for (const r of rows.values()) { const cur = map.get(r.task) ?? { calls: 0, tokens: 0 }; cur.calls += r.calls; cur.tokens += r.tokens; map.set(r.task, cur); }
  return [...map].sort((a, b) => b[1].tokens - a[1].tokens).map(([task, v]) => ({ label: AI_TASK_LABEL[task] ?? task, value: v.tokens, hint: `${formatNumber(v.calls)}회` }));
}

const APPS = [
  { id: 'minially', kind: 'minially', word: 'ally', name: '미니어리', desc: '일정·할 일·메모', href: APP_LINKS.minially },
  { id: 'minilog', kind: 'minilog', word: 'log', name: '미니로그', desc: '사진으로 블로그 원고 만들기', href: APP_LINKS.minilog },
] as const;

function Home({ me, onLogout, onMe }: { me: Me; onLogout: () => void; onMe: (next: Partial<Pick<Me, 'name' | 'theme'>>) => void }) {
  const [busy, setBusy] = useState(false);
  const [scope, setScopeState] = useState<Scope>(savedScope);
  // 지금 보는 칸(화면 위쪽 3분의 1에 들어온 칸)에 메뉴 띠를 둔다
  const [active, setActive] = useState('overview');
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(entries => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting);
      const first = NAV_IDS.find(id => seen.get(id));
      if (first) setActive(first);
    }, { rootMargin: '0px 0px -66% 0px' });
    for (const id of NAV_IDS) { const el = document.getElementById(id); if (el) io.observe(el); }
    return () => io.disconnect();
  }, [scope]);
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

  // 메뉴 이동: 'AI 사용량'은 내 대시보드의 사용량 칸(통합 화면이면 잠깐 내 대시보드로 바꿔 보여 줌, 기본 보기 설정은 그대로)
  const goNav = (event: MouseEvent<HTMLAnchorElement>, id: string) => { event.preventDefault(); goTo(id); };
  const goTo = (id: string) => {
    if (id === 'usage') setScopeState('me');
    setActive(id);
    window.history.replaceState(null, '', `#${id}`);
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // 빠른 찾기 목록: 화면 → 보는 범위 → 앱 열기
  const commands: Command[] = [
    ...NAV_MAIN.map(n => ({ id: `n-${n.id}`, label: n.label, group: '화면', run: () => goTo(n.id) })),
    { id: 'n-settings', label: '설정', hint: '이름·테마·Gemini 키', group: '화면', run: () => goTo('settings') },
    { id: 's-all', label: '두 사람 같이 보기', group: '보는 범위', run: () => { setScope('all'); goTo('overview'); } },
    { id: 's-me', label: '나만 보기', group: '보는 범위', run: () => { setScope('me'); goTo('overview'); } },
    ...APPS.map(app => ({ id: `a-${app.id}`, label: `${app.name} 열기`, group: '앱 열기', run: () => { window.location.assign(app.href); } })),
  ];

  async function logout() {
    setBusy(true);
    try { await api('/api/logout', { method: 'POST', body: {} }); } catch { /* 서버가 안 받아도 화면은 로그아웃 */ }
    onLogout();
  }

  return (
    <div className="shell">
      <CommandPalette commands={commands} />
      <aside className="side" aria-label="메뉴">
        <a className="brand" href="#overview" aria-label="미니허브 처음으로"><Signature kind="hub" word="hub" size={17} tomong={32} /></a>
        <button type="button" className="side-search" onClick={openPalette}><span>빠른 찾기</span><kbd aria-hidden="true">Ctrl K</kbd></button>
        <nav className="nav-wrap" aria-label="미니허브 메뉴">
          {/* 미니로그 시안 A와 같은 모양: 묶음 이름은 위에 작게, 메뉴는 아이콘 + 이름, 지금 보는 칸은 띠로 */}
          <div className="nav-label">보기</div>
          <div className="nav">
            {NAV_MAIN.slice(0, 2).map(item => <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? 'true' : undefined} onClick={event => goNav(event, item.id)}><NavIcon name={item.id} />{item.label}</a>)}
          </div>
          <div className="nav-label">관리</div>
          <div className="nav">
            {NAV_MAIN.slice(2).map(item => <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? 'true' : undefined} onClick={event => goNav(event, item.id)}><NavIcon name={item.id} />{item.label}</a>)}
          </div>
          <div className="nav-label">앱 열기</div>
          <div className="nav">
            {APPS.map(app => (
              <a key={app.id} href={app.href}><span className="nav-app"><Tomong kind={app.kind} size={20} />{app.name}</span><span className="ext" aria-hidden="true">↗</span></a>
            ))}
          </div>
        </nav>
        <a className="side-settings" href="#settings" aria-current={active === 'settings' ? 'true' : undefined} onClick={event => goNav(event, 'settings')}><NavIcon name="settings" />설정</a>
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
            <Tomong kind="hub" size={52} pose="wave" />
            <div>
              <h1 id="hello-title">{me.name === `사용자 ${me.user}` ? me.user : me.name}님, 오늘도 반가워요</h1>
              <p className="hello-line"><span className="hand">{line}</span><span className="muted small"> · {today}</span></p>
            </div>
            <div className="scope" role="group" aria-label="대시보드 보기">
              <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>두 사람 같이</button>
              <button aria-pressed={scope === 'me'} onClick={() => setScope('me')}>나만</button>
            </div>
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

        <Monthly compare={scope === 'all'} />
        {scope === 'all' && <AccountsPanel />}

        <section id="apps" aria-labelledby="apps-title">
          <h2 id="apps-title" className="section-title">앱 연결</h2>
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
              <details className="more-table"><summary>표로 보기</summary>
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
              </details>
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
      {/* 휴대폰(839px 이하): 아래 탭 4개, 설정은 오른쪽 위 톱니 */}
      <nav className="m-tabs" aria-label="미니허브 아래 탭">
        {NAV_MAIN.map(item => (
          <a key={item.id} href={`#${item.id}`} aria-label={`${item.label} 탭`} aria-current={active === item.id ? 'true' : undefined} onClick={event => goNav(event, item.id)}>
            <span className="m-tab-icon"><NavIcon name={item.id} size={20} /></span>{item.label}
          </a>
        ))}
      </nav>
      <a className="m-gear" href="#settings" aria-label="설정 열기" onClick={event => goNav(event, 'settings')}><NavIcon name="settings" size={20} /></a>
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
