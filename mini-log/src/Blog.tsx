import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Help } from './Help';
import { api, ApiError, formatNumber } from '../../shared/client/api';
import { Tomong } from './Tomong';

// 내 네이버 블로그: RSS로 글 목록, 통계는 캡처(AI가 읽음)나 손으로 기록
export interface Post {
  post_key: string; blog_id: string; url: string; title: string; published_on: string | null; summary: string; tags: string[];
  views: number | null; likes: number | null; comments: number | null; stats_on: string | null; draft_id: string | null;
}
interface BlogLink { blog_id: string; synced_at: number | null; post_count: number }
interface Blog { blogs: BlogLink[]; posts: Post[] }
type Synced = Blog & { added: number; total: number; matched: number; errors: string[] };
const syncText = (r: Synced) => `글 ${r.total}개(새로 ${r.added}개)를 가져왔어요.${r.matched ? ` 미니로그 원고 ${r.matched}개와 짝지었어요.` : ''}${r.errors.length ? ` ${r.errors.join(' ')}` : ''}`;
type Sort = 'recent' | 'views' | 'likes';
const num = (n: number | null) => (n === null ? '—' : formatNumber(n));
/** 블로그 키 → 보여 줄 이름·플랫폼·주소(네이버: 아이디, 티스토리: 'tistory:이름') */
export function blogInfo(key: string) {
  if (key.startsWith('tistory:')) { const name = key.slice(8); return { name, platform: '티스토리', home: `https://${name}.tistory.com` }; }
  return { name: key, platform: '네이버', home: `https://blog.naver.com/${key}` };
}

async function uploadStats(file: File) {
  let response: Response;
  try { response = await fetch('/api/blog/stats', { method: 'POST', body: file, credentials: 'same-origin', headers: { 'content-type': file.type || 'application/octet-stream' } }); }
  catch { throw new Error('인터넷 연결을 확인해 주세요.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError((data as { error?: string }).error ?? '캡처를 읽지 못했어요.', response.status);
  return data as Blog & { matched: { title: string }[]; unmatched: string[] };
}

export function BlogView({ onBack, onOpenDraft }: { onBack: () => void; onOpenDraft: (id: string) => void }) {
  const [blog, setBlog] = useState<Blog | null>(null);
  const [blogId, setBlogId] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [only, setOnly] = useState<string>('all');
  const [busy, setBusy] = useState<'save' | 'sync' | 'stats' | null>(null);
  const [editing, setEditing] = useState<{ key: string; views: string; likes: string; comments: string } | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    api<Blog>('/api/blog').then(d => setBlog(d)).catch(e => setMessage({ kind: 'error', text: e instanceof Error ? e.message : '불러오지 못했어요.' }));
  }, []);

  const posts = useMemo(() => {
    const list = (blog?.posts ?? []).filter(p => only === 'all' || p.blog_id === only);
    if (sort === 'views') list.sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
    if (sort === 'likes') list.sort((a, b) => (b.likes ?? -1) - (a.likes ?? -1));
    return list;
  }, [blog, sort, only]);
  const withStats = (blog?.posts ?? []).filter(p => p.views !== null);
  const top = [...withStats].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 3);

  async function addAndSync(event: FormEvent) {
    event.preventDefault();
    setBusy('save'); setMessage(null);
    try {
      const added = await api<Blog & { blog_id: string }>('/api/blog', { body: { blog_id: blogId } });
      setBlog(added); setBlogId('');
      setBusy('sync');
      const synced = await api<Synced>('/api/blog/sync', { body: { blog_id: added.blog_id } });
      setBlog(synced);
      setMessage({ kind: synced.errors.length ? 'error' : 'info', text: syncText(synced) });
    } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '가져오지 못했어요.' }); }
    finally { setBusy(null); }
  }

  async function syncAll(one?: string) {
    setBusy('sync'); setMessage(null);
    try {
      const synced = await api<Synced>('/api/blog/sync', { body: one ? { blog_id: one } : {} });
      setBlog(synced);
      setMessage({ kind: synced.errors.length ? 'error' : 'info', text: syncText(synced) });
    } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '가져오지 못했어요.' }); }
    finally { setBusy(null); }
  }

  async function removeLink(id: string) {
    if (!window.confirm(`${blogInfo(id).name} 블로그 연결을 지울까요? 이 블로그에서 가져온 글과 적어 둔 숫자도 지워져요.`)) return;
    try { setBlog(await api<Blog>(`/api/blog?blog_id=${encodeURIComponent(id)}`, { method: 'DELETE' })); if (only === id) setOnly('all'); }
    catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '지우지 못했어요.' }); }
  }

  async function onStatsFile(file: File | undefined) {
    if (!file) return;
    setBusy('stats'); setMessage(null);
    try {
      const result = await uploadStats(file);
      setBlog(result);
      setMessage({ kind: 'info', text: `캡처에서 글 ${result.matched.length}개의 숫자를 읽어 기록했어요.${result.unmatched.length ? ` 맞는 글을 못 찾은 것 ${result.unmatched.length}개: ${result.unmatched.slice(0, 3).join(', ')}` : ''}` });
    } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '캡처를 읽지 못했어요.' }); }
    finally { setBusy(null); }
  }

  async function saveStats(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      await api(`/api/blog/posts/${encodeURIComponent(editing.key)}`, { method: 'PUT', body: { views: editing.views, likes: editing.likes, comments: editing.comments } });
      const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
      const toNum = (v: string) => (v.trim() === '' ? null : Number(v.replace(/,/g, '')));
      setBlog(b => b && { ...b, posts: b.posts.map(p => (p.post_key === editing.key ? { ...p, views: toNum(editing.views), likes: toNum(editing.likes), comments: toNum(editing.comments), stats_on: today } : p)) });
      setEditing(null);
    } catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '저장하지 못했어요.' }); }
  }

  return (
    <article className="stack" aria-labelledby="blog-title">
      <div className="editor-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn ghost back" onClick={onBack}>← 목록</button>
          <h1 id="blog-title" style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>내 블로그</h1>
        </div>
      </div>
      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}

      <section className="card step" aria-labelledby="link-title">
        <h2 id="link-title" className="step-title">블로그 연결(네이버·티스토리)<span className="step-sub">{blog?.blogs.length ?? 0}/5개</span></h2>
        <Help short={<>네이버 아이디나 티스토리 주소를 적어요(공개 RSS만, 로그인 없음).</>}>네이버는 blog.naver.com/<b>아이디</b>, 티스토리는 <b>이름</b>.tistory.com 주소를 적어요. 블로그가 여러 개면 하나씩 더하면 돼요. 공개 RSS로 최근 글 목록만 가져오고, 로그인하거나 비밀번호를 받지 않아요.</Help>
        {blog && blog.blogs.length > 0 && (
          <ul className="blog-links">
            {blog.blogs.map(b => { const info = blogInfo(b.blog_id); return (
              <li key={b.blog_id}>
                <span className={`platform p-${info.platform === '티스토리' ? 'tistory' : 'naver'}`}>{info.platform}</span>
                <a href={info.home} target="_blank" rel="noopener noreferrer"><b>{info.name}</b></a>
                <span className="muted small">글 {b.post_count}개{b.synced_at ? ` · ${new Date(b.synced_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                <button className="btn ghost small" onClick={() => { void syncAll(b.blog_id); }} disabled={busy !== null} aria-label={`${info.name} 가져오기`}>가져오기</button>
                <button className="btn ghost small" onClick={() => { void removeLink(b.blog_id); }} disabled={busy !== null} aria-label={`${info.name} 연결 지우기`}>×</button>
              </li>
            ); })}
          </ul>
        )}
        {(blog?.blogs.length ?? 0) < 5 && (
          <form className="publish-row" onSubmit={addAndSync}>
            <label htmlFor="blog-id" className="sr-only">블로그 아이디</label>
            <input id="blog-id" className="input" value={blogId} maxLength={80} placeholder="예: blog.naver.com/myblog 또는 mytravel.tistory.com" onChange={e => setBlogId(e.target.value)} />
            <button className="btn primary" type="submit" disabled={!blogId.trim() || busy !== null}>{busy === 'save' ? '연결하는 중…' : '연결하고 가져오기'}</button>
          </form>
        )}
        {blog && blog.blogs.length > 1 && <button className="btn" style={{ justifySelf: 'start' }} onClick={() => { void syncAll(); }} disabled={busy !== null}>{busy === 'sync' ? '가져오는 중…' : '모두 다시 가져오기'}</button>}
        {busy === 'sync' && <span className="ai-busy" role="status"><Tomong kind="minilog" size={28} bounce /><span className="hand">블로그 글을 가져오고 있어요</span></span>}
      </section>

      {blog && blog.posts.length > 0 && (
        <section className="card step" aria-labelledby="stats-title">
          <h2 id="stats-title" className="step-title">조회수·공감 기록<span className="step-sub">숫자 있는 글 {withStats.length}/{blog.posts.length}</span></h2>
          <Help short={'통계 화면 캡처를 올리면 AI가 조회수를 읽어 적어요.'}>네이버·티스토리는 조회수를 가져갈 길을 열어 두지 않아서, 블로그 <b>통계</b> 화면(글별 조회수)을 캡처해 올리면 AI가 숫자를 읽어 기록해요. 글마다 직접 적어도 돼요. 캡처는 저장하지 않아요.</Help>
          <label className={`dropzone pick${busy === 'stats' ? ' busy' : ''}`}>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy !== null} onChange={e => { void onStatsFile(e.target.files?.[0]); e.target.value = ''; }} />
            {busy === 'stats' ? <span className="ai-busy" role="status"><Tomong kind="minilog" size={32} bounce /><span className="hand">토몽이가 숫자를 읽고 있어요</span></span> : <span><b>통계 캡처 올리기</b> · PNG·JPG</span>}
          </label>
          {top.length > 0 && (
            <ol className="top-posts" aria-label="조회수 TOP 3">
              {top.map((p, i) => <li key={p.post_key}><span className="rank">{i + 1}</span><a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a><span className="muted small">조회 {num(p.views)} · 공감 {num(p.likes)}</span></li>)}
            </ol>
          )}
        </section>
      )}

      {blog && (
        <section className="card step" aria-labelledby="posts-title">
          <div className="row-between">
            <h2 id="posts-title" className="step-title">가져온 글<span className="step-sub">{posts.length}개{blog.blogs.reduce((n, b) => n + b.post_count, 0) > blog.posts.length ? ` · 최근 ${blog.posts.length}개만 보여요(보고서·합계는 전체 기준)` : ''}</span></h2>
            {blog.blogs.length > 1 && (
              <div className="style-tabs" role="tablist" aria-label="블로그">
                <button role="tab" aria-selected={only === 'all'} onClick={() => setOnly('all')}>전체</button>
                {blog.blogs.map(b => <button key={b.blog_id} role="tab" aria-selected={only === b.blog_id} onClick={() => setOnly(b.blog_id)}>{blogInfo(b.blog_id).name}</button>)}
              </div>
            )}
            <div className="style-tabs" role="tablist" aria-label="정렬">
              {([['recent', '최신순'], ['views', '조회수순'], ['likes', '공감순']] as [Sort, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={sort === k} onClick={() => setSort(k)}>{l}</button>)}
            </div>
          </div>
          {blog.posts.length === 0 ? (
            <div className="profile"><Tomong kind="minilog" size={44} /><p className="muted small" style={{ margin: 0 }}>아직 가져온 글이 없어요. 위에서 블로그를 연결해 주세요.</p></div>
          ) : (
            <ul className="posts">
              {posts.map(p => (
                <li key={p.post_key} className="post">
                  <div className="post-main">
                    <a className="post-title" href={p.url} target="_blank" rel="noopener noreferrer">{p.title || '제목 없음'}</a>
                    <span className="muted small">{blog.blogs.length > 1 ? `${blogInfo(p.blog_id).name} · ` : ''}{p.published_on ?? ''}{p.tags.length ? ` · #${p.tags.slice(0, 3).join(' #')}` : ''}{p.draft_id ? ' · 미니로그 원고' : ''}</span>
                  </div>
                  {editing?.key === p.post_key ? (
                    <form className="stat-edit" onSubmit={saveStats} aria-label={`${p.title} 숫자 적기`}>
                      <label>조회<input className="input" inputMode="numeric" value={editing.views} onChange={e => setEditing({ ...editing, views: e.target.value })} /></label>
                      <label>공감<input className="input" inputMode="numeric" value={editing.likes} onChange={e => setEditing({ ...editing, likes: e.target.value })} /></label>
                      <label>댓글<input className="input" inputMode="numeric" value={editing.comments} onChange={e => setEditing({ ...editing, comments: e.target.value })} /></label>
                      <button className="btn primary small" type="submit">저장</button>
                      <button className="btn ghost small" type="button" onClick={() => setEditing(null)}>취소</button>
                    </form>
                  ) : (
                    <div className="post-stats">
                      <span><b>{num(p.views)}</b><small>조회</small></span>
                      <span><b>{num(p.likes)}</b><small>공감</small></span>
                      <span><b>{num(p.comments)}</b><small>댓글</small></span>
                      <button className="btn ghost small" onClick={() => setEditing({ key: p.post_key, views: p.views?.toString() ?? '', likes: p.likes?.toString() ?? '', comments: p.comments?.toString() ?? '' })} aria-label={`${p.title} 숫자 적기`}>적기</button>
                      {p.draft_id && <button className="btn ghost small" onClick={() => onOpenDraft(p.draft_id!)}>원고</button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </article>
  );
}
