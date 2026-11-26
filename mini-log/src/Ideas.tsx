import { useEffect, useState, type FormEvent } from 'react';
import { Help } from './Help';
import { api } from '../../shared/client/api';
import { Tomong } from './Tomong';
import { blogInfo } from './Blog';

// 글감 추천: 다가오는 시기 + 참고 블로그 최근 글 제목 + 내 블로그·일정 → AI가 글감 제안
export interface Idea { topic: string; title: string; reason: string; hashtags: string[]; source: string }
interface Season { label: string; from: string; to: string }
interface Watch { blog_id: string; titles: string[]; synced_at: number | null }
interface DemandItem { topic: string; post_by: string | null; reason: string; basis: 'last_year' | 'season' | 'steady'; views: number | null; url: string | null; tags: string[] }
interface WeekdayStat { day: number; label: string; posts: number; avg: number }
interface Demand { from: string; to: string; items: DemandItem[]; posts_with_views: number; posts_last_year: number; weekdays: { days: WeekdayStat[]; best: WeekdayStat | null } }
interface IdeasData { seasons: Season[]; demand: Demand; watch: Watch[]; last: { ideas: Idea[]; used_search: boolean; created_at: number } | null }

const SOURCE: Record<string, string> = { blogs: '참고 블로그', mine: '내 블로그', season: '시기', search: '구글 검색' };
const BASIS: Record<DemandItem['basis'], { label: string; src: string }> = { last_year: { label: '작년 이맘때', src: 'mine' }, season: { label: '시기', src: 'season' }, steady: { label: '꾸준히', src: 'mine' } };
const shortDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

export function IdeasView({ onBack, onUse }: { onBack: () => void; onUse: (idea: Idea, plannedOn: string | null) => Promise<void> }) {
  const [data, setData] = useState<IdeasData | null>(null);
  const [search, setSearch] = useState(false);
  const [blogId, setBlogId] = useState('');
  const [busy, setBusy] = useState<'ideas' | 'watch' | 'use' | null>(null);
  const [dates, setDates] = useState<Record<number, string>>({});
  const [demandDates, setDemandDates] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const fail = (e: unknown, text: string) => setMessage({ kind: 'error', text: e instanceof Error ? e.message : text });

  useEffect(() => { api<IdeasData>('/api/ideas').then(setData).catch(e => fail(e, '불러오지 못했어요.')); }, []);

  async function recommend() {
    setBusy('ideas'); setMessage(null);
    try {
      const made = await api<{ ideas: Idea[]; used_search: boolean; created_at: number }>('/api/ideas', { body: { search } });
      setData(d => d && { ...d, last: { ideas: made.ideas, used_search: made.used_search, created_at: made.created_at } });
      setDates({});
    } catch (e) { fail(e, '글감을 받지 못했어요.'); }
    finally { setBusy(null); }
  }

  async function watchCall(path: string, init: { method?: string; body?: unknown }) {
    setBusy('watch'); setMessage(null);
    try {
      const r = await api<{ watch: Watch[]; errors?: string[] }>(path, init);
      setData(d => d && { ...d, watch: r.watch });
      if (r.errors?.length) setMessage({ kind: 'error', text: r.errors.join(' ') });
      return true;
    } catch (e) { fail(e, '참고 블로그를 바꾸지 못했어요.'); return false; }
    finally { setBusy(null); }
  }

  async function addWatch(event: FormEvent) {
    event.preventDefault();
    if (await watchCall('/api/ideas/watch', { body: { blog_id: blogId } })) setBlogId('');
  }

  async function use(idea: Idea, plannedOn: string | null) {
    setBusy('use');
    try { await onUse(idea, plannedOn); } catch (e) { fail(e, '원고를 만들지 못했어요.'); setBusy(null); }
  }

  const ideas = data?.last?.ideas ?? [];
  return (
    <article className="stack" aria-labelledby="ideas-title">
      <div className="editor-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn ghost back" onClick={onBack}>← 목록</button>
          <h1 id="ideas-title" style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>글감</h1>
        </div>
      </div>
      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}

      <section className="card step" aria-labelledby="rec-title">
        <h2 id="rec-title" className="step-title">글감 추천받기{data?.last && <span className="step-sub">마지막 {new Date(data.last.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{data.last.used_search ? ' · 검색 포함' : ''}</span>}</h2>
        <Help short={'시기·참고 블로그·내 블로그·협찬 일정을 보고 글감을 골라요.'}>다가오는 시기(설·추석·크리스마스·휴가철 등), 아래 참고 블로그의 최근 글 제목, 내 블로그(조회수 높은 글·자주 쓰는 태그)와 협찬 마감·게시 예정을 보고 AI가 글감을 골라 줘요. 다른 블로그 글은 제목만 참고해요.</Help>
        <div className="publish-row" style={{ alignItems: 'center' }}>
          <label className="check"><input type="checkbox" checked={search} onChange={e => setSearch(e.target.checked)} disabled={busy !== null} /> 최신 검색 포함<span className="muted small"> (Gemini가 구글 검색도 해요, 사용량이 더 들어요)</span></label>
          <button className="btn primary" onClick={() => { void recommend(); }} disabled={!data || busy !== null}>{busy === 'ideas' ? '고르는 중…' : ideas.length ? '다시 추천받기' : '글감 추천받기'}</button>
        </div>
        {busy === 'ideas' && <span className="ai-busy" role="status"><Tomong kind="minilog" size={32} bounce /><span className="hand">토몽이가 글감을 고르고 있어요</span></span>}
        {ideas.length > 0 ? (
          <ul className="idea-list" aria-label="추천 글감">
            {ideas.map((idea, i) => (
              <li key={`${idea.title}-${i}`} className="idea">
                <div className="idea-head"><span className={`src s-${idea.source}`}>{SOURCE[idea.source] ?? idea.source}</span><b>{idea.title || idea.topic}</b></div>
                {idea.title && idea.topic && <span className="small">{idea.topic}</span>}
                {idea.reason && <span className="muted small">{idea.reason}</span>}
                {idea.hashtags.length > 0 && <span className="muted small">{idea.hashtags.map(h => `#${h}`).join(' ')}</span>}
                <div className="idea-actions">
                  <label className="sr-only" htmlFor={`idea-date-${i}`}>게시 예정일</label>
                  <input id={`idea-date-${i}`} type="date" className="input small-input" value={dates[i] ?? ''} onChange={e => setDates(d => ({ ...d, [i]: e.target.value }))} />
                  <button className="btn small" onClick={() => { void use(idea, dates[i] || null); }} disabled={busy !== null}>이걸로 원고 만들기</button>
                </div>
              </li>
            ))}
          </ul>
        ) : data && busy !== 'ideas' && (
          <div className="profile"><Tomong kind="minilog" size={44} /><p className="muted small" style={{ margin: 0 }}>아직 받은 글감이 없어요. 위 버튼을 눌러 보세요.</p></div>
        )}
      </section>

      <section className="card step" aria-labelledby="demand-title">
        <h2 id="demand-title" className="step-title">다음 4주 수요 예측{data && <span className="step-sub">내 글 기준 · {shortDay(data.demand.from)}~{shortDay(data.demand.to)}</span>}</h2>
        <Help short={'작년 이맘때 잘 된 내 글, 다가오는 시기, 꾸준히 잘 되는 태그로 쓸 주제와 올릴 날을 골라요.'}>AI를 부르지 않고 내 블로그 기록으로만 계산해요. 작년 같은 때(52주 전) 올린 글 중 조회수가 내 보통 글 이상인 것, 앞으로 6주 안의 시기(2주 전에 올리기)와 내가 예전에 쓴 같은 시기 글, 글 2편 이상에서 평균 조회수가 높은데 30일 넘게 안 쓴 태그를 보여 줘요. 조회수는 블로그 화면에서 마지막으로 넣은 누적 숫자라 오래된 글이 조금 유리해요. 검색량(네이버 데이터랩)은 아직 연결하지 않았어요.</Help>
        {data && (data.demand.items.length > 0 ? (
          <ul className="idea-list" aria-label="수요 예측">
            {data.demand.items.map((item, i) => {
              const basis = BASIS[item.basis];
              return (
                <li key={`${item.basis}-${item.topic}-${i}`} className="demand">
                  <div className="idea-head"><span className={`src s-${basis.src}`}>{basis.label}</span><b>{item.topic}</b><span className="muted small">{!item.post_by ? '언제든' : item.post_by <= data.demand.from ? '바로 올리기' : `${shortDay(item.post_by)}까지 올리기`}</span></div>
                  <span className="muted small">{item.reason}</span>
                  {item.url && /^https:\/\//.test(item.url) && <a className="small" href={item.url} target="_blank" rel="noopener noreferrer">예전 글 보기</a>}
                  <div className="idea-actions">
                    <label className="sr-only" htmlFor={`demand-date-${i}`}>올릴 날</label>
                    <input id={`demand-date-${i}`} type="date" className="input small-input" value={demandDates[i] ?? item.post_by ?? ''} onChange={e => setDemandDates(d => ({ ...d, [i]: e.target.value }))} />
                    <button className="btn small" onClick={() => { void use({ topic: item.topic, title: '', reason: item.reason, hashtags: item.tags, source: item.basis === 'season' ? 'season' : 'mine' }, (demandDates[i] ?? item.post_by) || null); }} disabled={busy !== null}>이걸로 원고 만들기</button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className="muted small" style={{ margin: 0 }}>아직 예측할 내 글 기록이 없어요. 블로그 화면에서 내 블로그를 연결하고 조회수를 넣어 보세요.</p>)}
        {data && data.demand.items.length > 0 && data.demand.posts_last_year === 0 && <p className="muted small" style={{ margin: 0 }}>작년 이맘때 글이 아직 없어서 시기·태그로만 골랐어요. 블로그를 오래 연결해 둘수록 정확해져요.</p>}
        {data && (
          <div className="weekday-best" aria-label="올리기 좋은 요일">
            {data.demand.weekdays.best
              ? <p className="small" style={{ margin: 0 }}><b>{data.demand.weekdays.best.label}요일</b>에 올린 글이 평균 조회 {data.demand.weekdays.best.avg.toLocaleString('ko-KR')}회로 가장 높아요.</p>
              : <p className="muted small" style={{ margin: 0 }}>조회수를 넣은 글이 6편 넘게 쌓이면 올리기 좋은 요일을 알려 줘요.</p>}
            {data.demand.weekdays.days.some(d => d.posts) && (
              <ul className="trend-chips">
                {data.demand.weekdays.days.filter(d => d.posts).map(d => <li key={d.day} className={d.day === data.demand.weekdays.best?.day ? 'chip-best' : undefined}>{d.label}<span className="muted"> {d.posts}편·평균 {d.avg.toLocaleString('ko-KR')}</span></li>)}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="card step" aria-labelledby="season-title">
        <h2 id="season-title" className="step-title">다가오는 시기<span className="step-sub">앞으로 45일</span></h2>
        <p className="muted small" style={{ margin: 0 }}>시기 1~3주 전에 올리면 검색이 많이 들어와요. 글감을 고를 때 AI가 이 시기를 먼저 봐요.</p>
        {data && (data.seasons.length > 0 ? (
          <ul className="trend-chips">
            {data.seasons.map(x => <li key={`${x.from}-${x.label}`}>{x.label}<span className="muted"> {Number(x.from.slice(5, 7))}/{Number(x.from.slice(8))}~{Number(x.to.slice(5, 7))}/{Number(x.to.slice(8))}</span></li>)}
          </ul>
        ) : <p className="muted small" style={{ margin: 0 }}>45일 안에 특별한 시기가 없어요.</p>)}
      </section>

      <section className="card step" aria-labelledby="watch-title">
        <h2 id="watch-title" className="step-title">참고 블로그<span className="step-sub">{data?.watch.length ?? 0}/10개</span></h2>
        <p className="muted small" style={{ margin: 0 }}>잘 되는 이웃·같은 주제 블로그를 적어 두면 최근 글 제목을 글감 고를 때 참고해요(네이버 아이디, ○○.tistory.com).</p>
        {data && data.watch.length > 0 && (
          <ul className="blog-links">
            {data.watch.map(w => { const info = blogInfo(w.blog_id); return (
              <li key={w.blog_id}>
                <span className={`platform p-${info.platform === '티스토리' ? 'tistory' : 'naver'}`}>{info.platform}</span>
                <a href={info.home} target="_blank" rel="noopener noreferrer"><b>{info.name}</b></a>
                <span className="muted small watch-titles">{w.titles.length ? w.titles.slice(0, 2).join(' · ') : '아직 못 가져왔어요'}</span>
                <button className="btn ghost small" onClick={() => { void watchCall(`/api/ideas/watch?blog_id=${encodeURIComponent(w.blog_id)}`, { method: 'DELETE' }); }} disabled={busy !== null} aria-label={`${info.name} 참고 블로그 지우기`}>×</button>
              </li>
            ); })}
          </ul>
        )}
        {(data?.watch.length ?? 0) < 10 && (
          <form className="publish-row" onSubmit={addWatch}>
            <label htmlFor="watch-id" className="sr-only">참고 블로그 주소</label>
            <input id="watch-id" className="input" value={blogId} maxLength={80} placeholder="예: blog.naver.com/neighbor 또는 food.tistory.com" onChange={e => setBlogId(e.target.value)} />
            <button className="btn" type="submit" disabled={!blogId.trim() || busy !== null}>{busy === 'watch' ? '가져오는 중…' : '더하기'}</button>
          </form>
        )}
        {data && data.watch.length > 0 && <button className="btn ghost small" style={{ justifySelf: 'start' }} onClick={() => { void watchCall('/api/ideas/watch', { method: 'PUT' }); }} disabled={busy !== null}>최근 제목 다시 가져오기</button>}
      </section>
    </article>
  );
}
