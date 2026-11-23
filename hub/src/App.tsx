import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, APP_LABELS, APP_LINKS, formatNumber, type UsageRow } from '../../shared/client/api';
import { Minito, Signature } from './Minito';

interface Me {
  user: 'C' | 'D';
  gemini: { connected: boolean };
  usage: { since: string; apps: UsageRow[] };
}

type State = { kind: 'loading' } | { kind: 'login' } | { kind: 'error'; message: string } | { kind: 'ready'; me: Me };

export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const me = await api<Me | { user: null }>('/api/me');
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
  return <Home me={state.me} onLogout={() => setState({ kind: 'login' })} />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
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
          <Minito kind="hub" size={88} pose="wave" bounce />
          <h1 className="sr-only">미니허브 로그인</h1>
          <Signature kind="hub" word="hub" size={22} minito={0} />
          <p className="hand login-line">미니어리 코드로 들어와요</p>
        </div>
        <div className="field">
          <label htmlFor="code">로그인 코드</label>
          <input
            id="code"
            className="input"
            value={code}
            onChange={e => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby={error ? 'code-error' : undefined}
          />
        </div>
        {error && <p id="code-error" className="error" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? '확인하는 중…' : '로그인'}</button>
      </form>
    </main>
  );
}

const APPS = [
  { id: 'minially', kind: 'minially', word: 'ally', name: '미니어리', desc: '일정·할 일·메모', href: APP_LINKS.minially },
  { id: 'minilog', kind: 'minilog', word: 'log', name: '미니로그', desc: '사진으로 블로그 원고 만들기', href: APP_LINKS.minilog },
] as const;

function Home({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [busy, setBusy] = useState(false);
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
        <a className="brand" href="#overview" aria-label="미니허브 처음으로"><Signature kind="hub" word="hub" size={17} minito={32} /></a>
        <nav className="nav-wrap" aria-label="미니허브 메뉴">
          <div className="nav">
            <a href="#overview">대시보드</a>
            <a href="#apps">앱</a>
            <a href="#usage">AI 사용량</a>
            <a href="#settings">설정</a>
          </div>
          <div className="nav-label">바로 가기</div>
          <div className="nav">
            {APPS.map(app => (
              <a key={app.id} href={app.href}><span className="nav-app"><Minito kind={app.kind} size={20} />{app.name}</span><span className="ext" aria-hidden="true">↗</span></a>
            ))}
          </div>
        </nav>
        <div className="side-foot">
          <div className="who">
            <span className="avatar" aria-hidden="true">{me.user}</span>
            <span className="who-text small">사용자 {me.user}</span>
          </div>
          <button className="btn ghost small" onClick={logout} disabled={busy}>로그아웃</button>
        </div>
      </aside>

      <main className="main">
        <section id="overview" className="stack" aria-labelledby="hello-title">
          <div className="card hello">
            <Minito kind="hub" size={76} pose="wave" />
            <div>
              <h1 id="hello-title">{me.user}님, 오늘도 반가워요</h1>
              <p className="hand hello-line">{line}</p>
              <p className="muted small" style={{ margin: 0 }}>{today}</p>
            </div>
          </div>
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
              <span className="hint">{me.gemini.connected ? `사용자 ${me.user}의 키` : <a href="#settings">연결 방법 보기</a>}</span>
            </div>
          </div>
        </section>

        <section id="apps" aria-labelledby="apps-title">
          <h2 id="apps-title" className="section-title">앱</h2>
          <div className="apps">
            {APPS.map(app => {
              const row = byApp.get(app.id);
              return (
                <article key={app.id} className={`card app-card ${app.id}`}>
                  <Minito kind={app.kind} size={64} />
                  <div className="app-info">
                    <h3><Signature kind={app.kind} word={app.word} size={17} minito={0} /><span className="sr-only">{app.name}</span></h3>
                    <p>{app.name} · {app.desc}</p>
                    <div className="app-stats">
                      <span>AI 호출 <strong>{formatNumber(row?.calls ?? 0)}</strong></span>
                      <span>토큰 <strong>{formatNumber((row?.input_tokens ?? 0) + (row?.output_tokens ?? 0))}</strong></span>
                    </div>
                  </div>
                  <a className="btn primary" href={app.href}>{app.name} 열기</a>
                </article>
              );
            })}
          </div>
        </section>

        <section id="usage" className="card" aria-labelledby="usage-title">
          <h2 id="usage-title" className="section-title">{month}월 앱별 AI 사용량</h2>
          {me.usage.apps.length === 0 ? (
            <div className="empty-usage">
              <Minito kind="hub" size={48} />
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
        </section>

        <section id="settings" aria-labelledby="settings-title">
          <h2 id="settings-title" className="section-title">설정</h2>
          <div className="settings">
            <div className="card">
              <h3 className="section-title" style={{ fontSize: '0.95rem' }}>계정</h3>
              <dl className="kv">
                <dt>사용자</dt><dd>{me.user}</dd>
                <dt>로그인</dt><dd>미니어리 로그인 코드</dd>
                <dt>로그인 유지</dt><dd>30일(로그아웃하면 바로 끝남)</dd>
              </dl>
            </div>
            <div className="card">
              <h3 className="section-title" style={{ fontSize: '0.95rem' }}>Gemini 키</h3>
              {me.gemini.connected ? (
                <p className="muted small" style={{ margin: 0 }}>사용자 {me.user}의 키가 서버 비밀값으로 등록돼 있어요. 미니어리와 미니로그가 함께 써요. 키를 바꾸려면 Cloudflare에서 <code>GEMINI_KEY_{me.user}</code> 값을 바꾸세요.</p>
              ) : (
                <>
                  <p className="muted small" style={{ margin: 0 }}>키는 보안을 위해 이 화면이 아니라 Cloudflare 비밀값으로 등록해요.</p>
                  <ol className="help small muted">
                    <li>Cloudflare → minihub·minilog 프로젝트 → Settings → Variables and Secrets</li>
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
