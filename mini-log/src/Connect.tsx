import { useEffect, useRef, useState } from 'react';
import { api } from '../../shared/client/api';

// 연결 안내(설정): 네이버(메일·캘린더)·Gmail을 화면에서 직접 연결한다.
// '연결하기'를 누르면 창 하나가 떠서 한 단계씩: ① 고르기 → ② 따라하기(휴대폰 그림으로 어디를 누르는지) → ③ 붙여 넣기 → ④ 연결 시험.
// 아래 버튼(← 이전 · 다음)은 단계가 바뀌어도 같은 자리에 있다. 비밀번호는 서버가 실제로 로그인해 본 뒤에만 암호화해 저장하고, 다시 보여 주지 않는다.
type Provider = 'naver' | 'gmail';
interface Account { provider: Provider; label: string; connected: boolean; source: 'app' | 'admin' | null; address: string }
interface State { can_save: boolean; accounts: Account[] }

interface Guide { title: string; steps: { text: string; screen: string; mark: string; note?: string }[]; link: { href: string; label: string }; loginLabel: string; loginHint: string; pwLabel: string; covers: string }
const GUIDES: Record<Provider, Guide> = {
  naver: {
    title: '네이버 애플리케이션 비밀번호 만들기',
    steps: [
      { text: '네이버 내정보 → 보안설정 → 2단계 인증 켜기', screen: '네이버 내정보', mark: '보안설정 → 2단계 인증', note: '휴대폰 인증 한 번' },
      { text: '2단계 인증 관리 → 애플리케이션 비밀번호 관리 → 종류 직접 입력 "미니로그" → 생성', screen: '2단계 인증 관리', mark: '애플리케이션 비밀번호 관리', note: '비밀번호가 한 번만 보여요. 바로 복사해 두세요' },
      { text: '네이버 메일 → 환경설정 → POP3/IMAP 설정 → IMAP/SMTP 사용함', screen: '메일 환경설정', mark: 'POP3/IMAP 설정 → IMAP 사용함', note: '메일만 해당(캘린더는 필요 없음)' },
    ],
    link: { href: 'https://nid.naver.com/user2/help/myInfo', label: '네이버 내정보 열기' },
    loginLabel: '네이버 아이디', loginHint: '예) tomong 또는 tomong@naver.com', pwLabel: '애플리케이션 비밀번호', covers: '메일 받기·보내기와 네이버 캘린더 일정 보기에 함께 써요.',
  },
  gmail: {
    title: 'Gmail 앱 비밀번호 만들기',
    steps: [
      { text: '구글 계정 → 보안 → 2단계 인증 켜기', screen: 'Google 계정 · 보안', mark: '2단계 인증', note: '이미 켜져 있으면 넘어가요' },
      { text: '맨 아래 앱 비밀번호 → 이름 "미니로그" → 만들기', screen: 'Google 계정 · 보안', mark: '앱 비밀번호' },
      { text: '노란 칸의 16자리를 복사', screen: '앱 비밀번호', mark: 'abcd efgh ijkl mnop', note: '띄어쓰기는 그대로 붙여 넣어도 돼요' },
    ],
    link: { href: 'https://myaccount.google.com/apppasswords', label: '구글 앱 비밀번호 열기' },
    loginLabel: 'Gmail 주소', loginHint: '예) tomong@gmail.com', pwLabel: '앱 비밀번호(16자리)', covers: '메일 받기·보내기에 써요. 구글 캘린더는 캘린더 화면의 비공개 주소로 따로 연결해요.',
  },
};
const STEP_NAMES = ['고르기', '따라하기', '붙여 넣기', '연결 시험'];

export function ConnectCard() {
  const [state, setState] = useState<State | null>(null);
  const [open, setOpen] = useState<Provider | null>(null);
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const load = () => api<State>('/api/connections').then(setState).catch(e => setMsg({ kind: 'error', text: e instanceof Error ? e.message : '연결 상태를 불러오지 못했어요.' }));
  useEffect(() => { void load(); }, []);
  async function disconnect(p: Provider) {
    setMsg(null);
    try { setState(await api<State>(`/api/connections?provider=${p}`, { method: 'DELETE' })); setMsg({ kind: 'info', text: '화면에서 넣은 연결을 끊었어요.' }); }
    catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : '끊지 못했어요.' }); }
  }
  return (
    <section className="card step" aria-labelledby="connect-title">
      <h2 id="connect-title" className="step-title">메일·캘린더 연결</h2>
      <p className="muted small" style={{ margin: 0 }}>앱 비밀번호로 연결해요. 로그인 비밀번호가 아니고, 미니로그 전용으로 따로 만드는 비밀번호예요. 저장할 때 암호화하고 다시 보여 주지 않아요.</p>
      {state && (
        <ul className="connect-list" aria-label="연결 상태">
          {state.accounts.map(a => (
            <li key={a.provider}>
              <span className={`conn-dot${a.connected ? ' on' : ''}`} aria-hidden="true" />
              <b>{a.label}</b>
              <span className="muted small">{a.connected ? `연결됨 · ${a.address}${a.source === 'admin' ? ' (관리자가 넣음)' : ''}` : '연결 안 함'}</span>
              <span className="conn-actions">
                <button type="button" className={`btn small${a.connected ? ' ghost' : ' primary'}`} onClick={() => setOpen(a.provider)}>{a.connected ? '다시 연결' : '연결하기'}</button>
                {a.source === 'app' && <button type="button" className="btn ghost small" aria-label={`${a.label} 연결 끊기`} onClick={() => { void disconnect(a.provider); }}>끊기</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {state && !state.can_save && <KeyMaker />}
      {msg && <p className={msg.kind === 'error' ? 'error small' : 'muted small'} role={msg.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{msg.text}</p>}
      {open && state && <ConnectWizard start={open} canSave={state.can_save} onClose={() => setOpen(null)} onDone={s => { setState(s); setMsg({ kind: 'info', text: '연결했어요. 메일 화면에서 바로 받아 볼 수 있어요.' }); }} />}
    </section>
  );
}

/** 관리자용: 암호화 키(CRED_KEY)를 이 기기 브라우저 안에서만 만든다(서버로 보내지 않음). 소유자가 Cloudflare 비밀값에 넣는다 */
function KeyMaker() {
  const [key, setKey] = useState('');
  const make = () => { const a = crypto.getRandomValues(new Uint8Array(32)); let s = ''; for (const b of a) s += String.fromCharCode(b); setKey(btoa(s)); };
  return (
    <details className="small">
      <summary>아직 화면에서 연결할 수 없어요 · 관리자용</summary>
      <p className="muted" style={{ margin: '6px 0' }}>Cloudflare(mini-log) 설정 → 변수 및 비밀 → 비밀값 <code>CRED_KEY</code>에 아래 값을 넣고 다시 배포하면 켜져요. 값은 이 기기에서만 만들고 어디에도 저장하지 않아요. 한 번 넣은 뒤 바꾸면 저장된 연결을 다시 해야 해요.</p>
      <div className="ai-row">
        <button type="button" className="btn small" onClick={make}>암호화 키 만들기</button>
        {key && <input className="input" readOnly value={key} aria-label="CRED_KEY 값" onFocus={e => e.currentTarget.select()} style={{ flex: '1 1 260px', fontFamily: 'monospace' }} />}
      </div>
    </details>
  );
}

function PhoneSketch({ screen, marks }: { screen: string; marks: string[] }) {
  return (
    <div className="phone-sketch" aria-hidden="true">
      <div className="ps-title">{screen}</div>
      <div className="ps-line" /><div className="ps-line short" />
      {marks.map((m, i) => <div key={i} className={i === marks.length - 1 ? 'ps-mark' : 'ps-mark done'}>{m}</div>)}
      <div className="ps-line" />
    </div>
  );
}

function ConnectWizard({ start, canSave, onClose, onDone }: { start: Provider; canSave: boolean; onClose: () => void; onDone: (s: State) => void }) {
  const [step, setStep] = useState(1); // 0 고르기 · 1 따라하기 · 2 붙여 넣기 · 3 연결 시험
  const [provider, setProvider] = useState<Provider>(start);
  const [sub, setSub] = useState(0); // 따라하기 안에서 몇 번째 그림
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const g = GUIDES[provider];
  useEffect(() => {
    box.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  async function test() {
    setBusy(true); setResult(null); setStep(3);
    try {
      const s = await api<State>('/api/connections', { method: 'PUT', body: { provider, login, password } });
      setPassword('');
      setResult({ ok: true, text: `로그인 성공 · 저장했어요. ${g.covers}` });
      onDone(s);
    } catch (e) { setResult({ ok: false, text: e instanceof Error ? e.message : '연결하지 못했어요.' }); }
    finally { setBusy(false); }
  }
  // 아래 버튼: 자리는 고정, 글자만 단계에 맞게
  const next: { label: string; run: () => void; disabled?: boolean } =
    step === 0 ? { label: '다음: 따라하기 →', run: () => { setStep(1); setSub(0); } }
    : step === 1 ? (sub < g.steps.length - 1 ? { label: `다음 그림 (${sub + 2}/${g.steps.length}) →`, run: () => setSub(sub + 1) } : { label: '다음: 붙여 넣기 →', run: () => setStep(2) })
    : step === 2 ? { label: busy ? '시험하는 중…' : '연결 시험하고 저장', run: () => { void test(); }, disabled: busy || !canSave || !login.trim() || !password.trim() }
    : result?.ok ? { label: '닫기', run: onClose } : { label: busy ? '시험하는 중…' : '다시 붙여 넣기', run: () => setStep(2), disabled: busy };
  const back = step === 1 && sub > 0 ? () => setSub(sub - 1) : step > 0 && !(step === 3 && result?.ok) ? () => setStep(step === 3 ? 2 : step - 1) : null;

  return (
    <div className="wiz-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wiz card" role="dialog" aria-modal="true" aria-labelledby="wiz-title" tabIndex={-1} ref={box}>
        <ol className="wiz-steps" aria-label="연결 단계">
          {STEP_NAMES.map((n, i) => <li key={n} className={i < step ? 'done' : i === step ? 'now' : ''} aria-current={i === step ? 'step' : undefined}><span className="n">{i + 1}</span>{n}{i < step ? ' ✓' : ''}</li>)}
        </ol>
        <button type="button" className="btn ghost wiz-close" aria-label="연결 창 닫기" onClick={onClose}>✕</button>

        <div className="wiz-body">
          {step === 0 && (
            <>
              <h2 id="wiz-title">어디를 연결할까요?</h2>
              <div className="wiz-pick" role="radiogroup" aria-label="연결할 곳">
                {(['naver', 'gmail'] as Provider[]).map(p => (
                  <button key={p} type="button" role="radio" aria-checked={provider === p} className={`wiz-choice${provider === p ? ' on' : ''}`} onClick={() => { setProvider(p); setSub(0); }}>
                    <b>{p === 'naver' ? '네이버' : 'Gmail'}</b><span className="muted small">{GUIDES[p].covers}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 1 && (
            <div className="wiz-follow">
              <div>
                <h2 id="wiz-title">{g.title}</h2>
                <ol className="wiz-howto">
                  {g.steps.map((s, i) => (
                    <li key={i} className={i === sub ? 'now' : i < sub ? 'done' : ''}>
                      <button type="button" className="link-btn" onClick={() => setSub(i)} aria-current={i === sub ? 'step' : undefined}><span className="n">{i + 1}</span>{s.text}</button>
                      {i === sub && s.note && <span className="muted small">{s.note}</span>}
                    </li>
                  ))}
                </ol>
                <a className="btn small" href={g.link.href} target="_blank" rel="noopener noreferrer">{g.link.label} ↗</a>
              </div>
              <PhoneSketch screen={g.steps[sub].screen} marks={[g.steps[sub].mark]} />
            </div>
          )}
          {step === 2 && (
            <form className="wiz-paste" onSubmit={e => { e.preventDefault(); if (!next.disabled) next.run(); }}>
              <h2 id="wiz-title">{provider === 'naver' ? '네이버' : 'Gmail'} 여기에 붙여 넣기</h2>
              {!canSave && <p className="error small" role="alert" style={{ margin: 0 }}>아직 화면에서 연결할 수 없어요. 관리자가 암호화 키(CRED_KEY)를 먼저 넣어야 해요.</p>}
              <label className="field small">{g.loginLabel}
                <input className="input" value={login} autoComplete="username" placeholder={g.loginHint} maxLength={120} onChange={e => setLogin(e.target.value)} />
              </label>
              <label className="field small">{g.pwLabel}
                <input className="input" type="password" value={password} autoComplete="off" maxLength={80} onChange={e => setPassword(e.target.value)} />
              </label>
              <p className="muted small" style={{ margin: 0 }}>{g.covers} 실제로 로그인해 보고, 되면 암호화해서 저장해요.</p>
            </form>
          )}
          {step === 3 && (
            <div className="wiz-result">
              <h2 id="wiz-title">연결 시험</h2>
              {busy && <p className="muted" role="status">{provider === 'naver' ? '네이버' : 'Gmail'}에 로그인해 보는 중…</p>}
              {result && <p className={result.ok ? 'ok-text' : 'error'} role={result.ok ? 'status' : 'alert'}>{result.ok ? '✓ ' : ''}{result.text}</p>}
              {result && !result.ok && <p className="muted small" style={{ margin: 0 }}>로그인 비밀번호가 아니라 앱 비밀번호인지, {provider === 'naver' ? 'IMAP 사용함으로 켰는지' : '2단계 인증이 켜져 있는지'} 확인해 주세요.</p>}
            </div>
          )}
        </div>

        <div className="wiz-foot">
          <button type="button" className="btn ghost" onClick={() => back?.()} disabled={!back} style={{ visibility: back ? 'visible' : 'hidden' }}>← 이전</button>
          <button type="button" className="btn primary" onClick={next.run} disabled={next.disabled}>{next.label}</button>
        </div>
      </div>
    </div>
  );
}
