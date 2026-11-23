import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, APP_LINKS } from '../../shared/client/api';

interface Draft {
  id: string; title: string; body: string; hashtags: string[]; experience: string;
  status: 'draft' | 'approved'; created_at: number; updated_at: number;
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
        <div>
          <div className="brand">미니로그</div>
          <p className="muted small" style={{ margin: '4px 0 0' }}>미니어리에서 쓰는 코드로 로그인해요.</p>
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
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try { setDrafts((await api<{ drafts: Draft[] }>('/api/drafts')).drafts); setListError(''); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) onLogout();
      else setListError(error instanceof Error ? error.message : '원고 목록을 불러오지 못했어요.');
    }
  }, [onLogout]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function create() {
    setCreating(true);
    try {
      const { draft } = await api<{ draft: Draft }>('/api/drafts', { method: 'POST', body: {} });
      setDrafts(list => [draft, ...(list ?? [])]);
      setSelectedId(draft.id);
    } catch (error) { setListError(error instanceof Error ? error.message : '새 원고를 만들지 못했어요.'); }
    finally { setCreating(false); }
  }

  async function logout() {
    try { await api('/api/logout', { method: 'POST', body: {} }); } catch { /* 화면은 로그아웃 */ }
    onLogout();
  }

  const selected = drafts?.find(d => d.id === selectedId) ?? null;
  const onSaved = useCallback((draft: Draft) => setDrafts(list => list?.map(d => (d.id === draft.id ? draft : d)).sort((a, b) => b.updated_at - a.updated_at) ?? null), []);
  const onDeleted = useCallback((id: string) => { setDrafts(list => list?.filter(d => d.id !== id) ?? null); setSelectedId(null); }, []);

  return (
    <div className={`shell${selected ? ' editing' : ''}`}>
      <aside className="side" aria-label="원고 목록">
        <div className="brand"><img src="/icon.svg" alt="" />미니로그</div>
        <button className="btn primary" onClick={create} disabled={creating}>{creating ? '만드는 중…' : '새 원고'}</button>
        {listError && <p className="error" role="alert">{listError}</p>}
        {drafts === null && !listError && <p className="muted small" role="status">불러오는 중…</p>}
        {drafts?.length === 0 && <p className="muted small">아직 원고가 없어요. <b>새 원고</b>로 시작하세요.</p>}
        {drafts && drafts.length > 0 && (
          <nav className="list" aria-label="원고">
            {drafts.map(d => (
              <button key={d.id} aria-current={d.id === selectedId} onClick={() => setSelectedId(d.id)}>
                <span className="t">{d.title.trim() || '제목 없는 원고'}</span>
                <span className="m">{d.status === 'approved' ? '승인됨' : '작성 중'} · {dateLabel(d.updated_at)}</span>
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
        {selected
          ? <Editor key={selected.id} draft={selected} gemini={me.gemini.connected} onSaved={onSaved} onDeleted={onDeleted} onBack={() => setSelectedId(null)} />
          : (
            <div className="card empty">
              <h1 style={{ margin: 0, fontSize: '1.2rem' }}>사진과 경험으로 블로그 원고 만들기</h1>
              <p className="muted small" style={{ margin: 0 }}>왼쪽에서 원고를 고르거나 새 원고를 만드세요.</p>
              {!me.gemini.connected && <p className="error">Gemini 키가 아직 연결되지 않아 AI 초안은 만들 수 없어요. 원고 저장은 할 수 있어요.</p>}
            </div>
          )}
      </main>
    </div>
  );
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'failed';
type Fields = Pick<Draft, 'title' | 'body' | 'experience' | 'hashtags' | 'status'>;

function Editor({ draft, gemini, onSaved, onDeleted, onBack }: {
  draft: Draft; gemini: boolean; onSaved: (d: Draft) => void; onDeleted: (id: string) => void; onBack: () => void;
}) {
  const [fields, setFields] = useState<Fields>({ title: draft.title, body: draft.body, experience: draft.experience, hashtags: draft.hashtags, status: draft.status });
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
      setFields({ title: made.title, body: made.body, experience: made.experience, hashtags: made.hashtags, status: made.status });
      setTagText(made.hashtags.map(t => `#${t}`).join(' '));
      onSaved(made);
      setMessage({ kind: 'info', text: 'AI 초안을 넣었어요. [작성자 확인 필요] 표시가 있으면 꼭 고쳐 주세요.' });
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
          <span className={`badge${fields.status === 'approved' ? ' approved' : ''}`}>{fields.status === 'approved' ? '승인됨' : '작성 중'}</span>
          <span className={`save-state${save === 'failed' ? ' fail' : ''}`} role="status">{saveLabel}</span>
          {save === 'failed' && <button className="btn small" onClick={() => { void flush(); }}>다시 저장</button>}
        </div>
        <div className="actions">
          <button className="btn" onClick={copyPackage} disabled={!fields.title.trim() && !fields.body.trim()}>발행용 복사</button>
          <button className="btn" onClick={() => change({ status: fields.status === 'approved' ? 'draft' : 'approved' })}>{fields.status === 'approved' ? '승인 취소' : '원고 승인'}</button>
          <button className="btn ghost" onClick={remove}>삭제</button>
        </div>
      </div>

      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}

      <section className="card step" aria-labelledby="s1">
        <h2 id="s1" className="step-title"><span className="n">1</span>사진</h2>
        <div className="dropzone small">사진 올리기·분석은 준비 중이에요(사진 저장소 R2 연결 뒤 사용 가능).</div>
      </section>

      <section className="card step" aria-labelledby="s2">
        <h2 id="s2" className="step-title"><span className="n">2</span>실제 방문·사용 경험</h2>
        <div className="field">
          <label htmlFor="experience" className="small muted" style={{ fontWeight: 500 }}>언제·어디서·무엇을 했고 어땠는지 직접 겪은 내용을 적어 주세요. AI는 여기 적힌 것만 써요.</label>
          <textarea id="experience" className="textarea" value={fields.experience} maxLength={5000} onChange={e => change({ experience: e.target.value })} />
        </div>
        <button className="btn primary" style={{ justifySelf: 'start' }} onClick={generate} disabled={aiBusy || !gemini}>
          {aiBusy ? 'AI가 쓰는 중…' : 'AI로 초안 만들기'}
        </button>
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
    </article>
  );
}
