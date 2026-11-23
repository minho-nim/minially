import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, APP_LINKS } from '../../shared/client/api';
import { Tomong, Signature } from './Tomong';
import { renumberMarkers } from './photoMarkers';

type Status = 'draft' | 'approved' | 'published';
interface Draft {
  id: string; title: string; body: string; hashtags: string[]; experience: string;
  status: Status; published_url: string; published_at: number | null; created_at: number; updated_at: number;
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
  const onSaved = useCallback((draft: Draft) => setDrafts(list => list?.map(d => (d.id === draft.id ? { ...draft, photo_count: draft.photo_count ?? d.photo_count } : d)).sort((a, b) => b.updated_at - a.updated_at) ?? null), []);
  const onPhotoCount = useCallback((n: number) => setDrafts(list => {
    if (!list || !selectedId) return list;
    const current = list.find(d => d.id === selectedId);
    return current && current.photo_count !== n ? list.map(d => (d.id === selectedId ? { ...d, photo_count: n } : d)) : list;
  }), [selectedId]);
  const onDeleted = useCallback((id: string) => { setDrafts(list => list?.filter(d => d.id !== id) ?? null); setSelectedId(null); }, []);

  return (
    <div className={`shell${selected ? ' editing' : ''}`}>
      <aside className="side" aria-label="원고 목록">
        <div className="brand"><Signature kind="minilog" word="log" size={17} tomong={32} /></div>
        <button className="btn primary" onClick={create} disabled={creating}>{creating ? '만드는 중…' : '새 원고'}</button>
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
              <button key={d.id} aria-current={d.id === selectedId} onClick={() => setSelectedId(d.id)}>
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
        {selected
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

type SaveState = 'saved' | 'dirty' | 'saving' | 'failed';
type Fields = Pick<Draft, 'title' | 'body' | 'experience' | 'hashtags' | 'status'>;

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
