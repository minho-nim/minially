import { useEffect, useState } from 'react';
import { Skeleton } from './Skeleton';
import { api } from '../../shared/client/api';
import { EmptyState } from './EmptyState';

// 게시 7일 뒤 돌아보기: 올린 지 7일 지난 글을 하나씩 보고 잘 됨·보통·아쉬움과 메모를 남긴다(AI 안 씀).
// 다음 글을 쓸 때 참고하도록 최근 평가 5개를 아래에 모아 둔다.
type Verdict = 'good' | 'ok' | 'low';
interface Due { draft_id: string; title: string; published_at: number; url: string; views: number | null; likes: number | null; comments: number | null; ratio: number | null }
interface Saved { draft_id: string; title: string; verdict: Verdict; note: string; views: number | null; created_at: number }
interface State { due: Due[]; recent: Saved[] }

export const VERDICT_LABEL: Record<Verdict, string> = { good: '잘 됨', ok: '보통', low: '아쉬움' };
const kstDay = (ms: number) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date(ms));
const num = (n: number) => n.toLocaleString('ko-KR');

function DueItem({ item, onSaved }: { item: Due; onSaved: (s: State) => void }) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!verdict) return;
    setBusy(true); setError('');
    try { onSaved(await api<State>('/api/reviews', { body: { draft_id: item.draft_id, verdict, note } })); }
    catch (e) { setError(e instanceof Error ? e.message : '저장하지 못했어요.'); setBusy(false); }
  };
  const id = `rv-${item.draft_id}`;
  return (
    <li className="review-item" aria-labelledby={`${id}-t`}>
      <div className="row-between">
        <b id={`${id}-t`}>{item.title}</b>
        <span className="muted small">{kstDay(item.published_at)} 게시</span>
      </div>
      <p className="small" style={{ margin: 0 }}>
        {item.views === null
          ? <span className="muted">조회수가 아직 없어요. 블로그 화면에서 글 숫자를 넣으면 평소와 비교해 보여요.</span>
          : <>조회 {num(item.views)}{item.likes !== null && ` · 공감 ${num(item.likes)}`}{item.comments !== null && ` · 댓글 ${num(item.comments)}`}
            {item.ratio !== null && <b className={item.ratio >= 1.2 ? 'up' : item.ratio < 0.8 ? 'down' : ''}> · 내 평소의 {item.ratio}배</b>}</>}
        {item.url && /^https:\/\//.test(item.url) && <> · <a href={item.url} target="_blank" rel="noopener noreferrer">글 열기</a></>}
      </p>
      <div className="seg" role="group" aria-label={`${item.title} 평가`}>
        {(Object.keys(VERDICT_LABEL) as Verdict[]).map(v => (
          <button key={v} type="button" className="btn small" aria-pressed={verdict === v} onClick={() => setVerdict(v)}>{VERDICT_LABEL[v]}</button>
        ))}
      </div>
      <label className="sr-only" htmlFor={`${id}-n`}>{item.title} 메모</label>
      <textarea id={`${id}-n`} className="textarea" rows={2} maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="잘 된 점, 다음에 바꿀 점(예: 제목에 지역 이름 넣기)" />
      <div className="row-between">
        <span className="muted small">{note.length}/300자</span>
        <button type="button" className="btn primary small" aria-busy={busy} disabled={!verdict || busy} onClick={() => { void save(); }}>{busy ? '저장 중…' : '돌아보기 저장'}</button>
      </div>
      {error && <p className="error small" role="alert">{error}</p>}
    </li>
  );
}

export function ReviewCard() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<State>('/api/reviews').then(setState).catch(e => setError(e instanceof Error ? e.message : '불러오지 못했어요.')); }, []);
  return (
    <section className="card step review-card" aria-labelledby="d-review">
      <h2 id="d-review" className="step-title">게시 7일 뒤 돌아보기<span className="step-sub">{state ? `돌아볼 글 ${state.due.length}개` : ''}</span></h2>
      {error && <p className="error small" role="alert">{error}</p>}
      {!state && !error && <Skeleton rows={2} />}
      {state && (state.due.length === 0
        ? <EmptyState title="아직 돌아볼 글이 없어요" desc="게시하고 7일이 지난 글이 생기면 여기서 하나씩 잘 된 점·바꿀 점을 남겨요."
            example={<div className="review-item"><b>연남동 브런치 카페 솔직 후기</b><span className="small">조회 1,240 · <b className="up">내 평소의 1.6배</b></span><span className="small muted">메모: 제목에 지역 이름을 앞에 넣으니 잘 됐다</span></div>} />
        : <ul className="review-list">{state.due.map(item => <DueItem key={item.draft_id} item={item} onSaved={setState} />)}</ul>)}
      {state && state.recent.length > 0 && (
        <>
          <h3 className="small" style={{ margin: '8px 0 4px' }}>최근 돌아본 글</h3>
          <ul className="review-recent" aria-label="최근 돌아본 글">
            {state.recent.map(r => (
              <li key={r.draft_id}><span className={`verdict v-${r.verdict}`}>{VERDICT_LABEL[r.verdict]}</span><span className="r-main"><b>{r.title}</b>{r.note && <span className="muted small">{r.note}</span>}</span></li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
