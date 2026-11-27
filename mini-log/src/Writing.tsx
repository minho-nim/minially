import { useState } from 'react';
import { api } from '../../shared/client/api';

// 블로그 글쓰기 고도화 화면 조각: 개요 먼저 · 제목 후보 · 판 기록. (고른 부분 다시 쓰기는 BodyEditor, 사진 설명 후보는 PhotoNotes)
// AI 글은 모두 React 글자로만 그린다(HTML로 넣지 않음). AI가 낸 것은 사람이 눌러야 원고에 들어간다.

export interface OutlineSection { heading: string; points: string; photos: number[] }

/** 개요 먼저: 소제목·문단 내용·사진 번호를 받아 고치고, '이 개요로 본문 쓰기'로 초안을 만든다 */
export function OutlinePlanner({ draftId, experience, postType, structure, disabled, onWrite, onError }: {
  draftId: string; experience: string; postType: string; structure: string; disabled: boolean;
  onWrite: (sections: OutlineSection[]) => void; onError: (text: string) => void;
}) {
  const [sections, setSections] = useState<OutlineSection[] | null>(null);
  const [photos, setPhotos] = useState(0);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (experience.trim().length < 10) { onError('실제 방문·사용 경험을 10자 이상 적어 주세요.'); return; }
    setBusy(true);
    try {
      const r = await api<{ sections: OutlineSection[]; photos: number }>(`/api/drafts/${draftId}/outline`, { body: { experience, post_type: postType, structure } });
      setSections(r.sections); setPhotos(r.photos);
    } catch (e) { onError(e instanceof Error ? e.message : '개요를 만들지 못했어요.'); }
    finally { setBusy(false); }
  }
  const edit = (i: number, patch: Partial<OutlineSection>) => setSections(s => s?.map((x, k) => (k === i ? { ...x, ...patch } : x)) ?? null);
  const move = (i: number, d: -1 | 1) => setSections(s => { if (!s || i + d < 0 || i + d >= s.length) return s; const n = [...s]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const used = new Set(sections?.flatMap(s => s.photos) ?? []);
  const unused = Array.from({ length: photos }, (_, i) => i + 1).filter(n => !used.has(n));

  if (!sections) {
    return (
      <button type="button" className="btn ghost" onClick={() => { void load(); }} disabled={disabled || busy}>
        {busy ? '개요 짜는 중…' : '개요 먼저 보기'}
      </button>
    );
  }
  return (
    <section className="outline-plan" aria-label="개요">
      <div className="outline-head">
        <b>개요</b>
        <span className="muted small">소제목·순서·사진을 고친 뒤 본문을 써요</span>
        <button type="button" className="btn small ghost" onClick={() => setSections(null)}>닫기</button>
      </div>
      <ol className="outline-list">
        {sections.map((s, i) => (
          <li key={i} className="outline-item">
            <div className="outline-row">
              <span className="outline-n" aria-hidden="true">{i + 1}</span>
              <label className="sr-only" htmlFor={`ol-h-${i}`}>{i + 1}번 소제목</label>
              <input id={`ol-h-${i}`} className="input" value={s.heading} maxLength={60} onChange={e => edit(i, { heading: e.target.value })} />
              <span className="outline-move">
                <button type="button" className="btn small ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${i + 1}번 소제목 위로`}>↑</button>
                <button type="button" className="btn small ghost" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label={`${i + 1}번 소제목 아래로`}>↓</button>
                <button type="button" className="btn small ghost" onClick={() => setSections(sections.filter((_, k) => k !== i))} disabled={sections.length === 1} aria-label={`${i + 1}번 소제목 빼기`}>×</button>
              </span>
            </div>
            <label className="sr-only" htmlFor={`ol-p-${i}`}>{i + 1}번 들어갈 내용</label>
            <textarea id={`ol-p-${i}`} className="textarea outline-points" value={s.points} maxLength={300} rows={2} onChange={e => edit(i, { points: e.target.value })} />
            {photos > 0 && (
              <div className="outline-photos" role="group" aria-label={`${i + 1}번에 넣을 사진`}>
                <span className="muted small">사진</span>
                {Array.from({ length: photos }, (_, k) => k + 1).map(n => (
                  <button key={n} type="button" className="chip-btn small" aria-pressed={s.photos.includes(n)}
                    onClick={() => edit(i, { photos: s.photos.includes(n) ? s.photos.filter(x => x !== n) : [...s.photos, n].sort((a, b) => a - b) })}>{n}</button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="ai-row">
        <button type="button" className="btn small ghost" onClick={() => setSections([...sections, { heading: '새 소제목', points: '', photos: [] }])} disabled={sections.length >= 7}>+ 소제목 더하기</button>
        {unused.length > 0 && <span className="muted small">아직 안 넣은 사진: {unused.join(', ')}</span>}
        <button type="button" className="btn primary" onClick={() => onWrite(sections.filter(s => s.heading.trim()))} disabled={disabled || !sections.some(s => s.heading.trim())}>이 개요로 본문 쓰기</button>
      </div>
    </section>
  );
}

interface TitleIdea { title: string; reason: string; checks: string[] }
/** 제목 후보 3개(이유·규칙 점검)와 내 인기 글 제목 비교 */
export function TitleIdeas({ draftId, body, title, disabled, onPick, onError }: { draftId: string; body: string; title: string; disabled: boolean; onPick: (t: string) => void; onError: (text: string) => void }) {
  const [ideas, setIdeas] = useState<{ titles: TitleIdea[]; top: { title: string; views: number }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try { setIdeas(await api(`/api/drafts/${draftId}/titles`, { body: { body, title } })); }
    catch (e) { onError(e instanceof Error ? e.message : '제목 후보를 만들지 못했어요.'); }
    finally { setBusy(false); }
  }
  return (
    <div className="title-ideas">
      <button type="button" className="btn small ghost" onClick={() => { void load(); }} disabled={disabled || busy || body.trim().length < 50}>
        {busy ? '제목 고르는 중…' : ideas ? '제목 후보 다시' : '제목 후보 3개'}
      </button>
      {ideas && (
        <div className="title-list" aria-label="추천 후보 목록">
          <ul>
            {ideas.titles.map(t => (
              <li key={t.title}>
                <div className="title-text"><b>{t.title}</b>{t.reason && <span className="muted small">{t.reason}</span>}<span className="title-checks small">{t.checks.join(' · ')}</span></div>
                <button type="button" className="btn small" onClick={() => onPick(t.title)}>이걸로</button>
              </li>
            ))}
          </ul>
          {ideas.top.length > 0 && <p className="muted small" style={{ margin: 0 }}>비교: 내 인기 글 {ideas.top.map(t => `‘${t.title}’(${t.views.toLocaleString('ko-KR')}회)`).join(' · ')}</p>}
        </div>
      )}
    </div>
  );
}

interface Version { id: string; kind: 'before_ai' | 'ai' | 'edit' | 'final'; title: string; body: string; created_at: number }
const KIND: Record<Version['kind'], string> = { before_ai: 'AI 초안 넣기 전', ai: 'AI 초안', edit: '고친 글', final: '최종(승인·게시)' };
const when = (t: number) => new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }).format(t);

/** 판 기록: AI 초안·고친 글·최종을 보고 그 판으로 되돌린다(되돌린 글은 평소처럼 저장) */
export function VersionHistory({ draftId, onRestore, onError }: { draftId: string; onRestore: (v: { title: string; body: string }) => void; onError: (text: string) => void }) {
  const [list, setList] = useState<Version[] | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  async function load() {
    try { setList((await api<{ versions: Version[] }>(`/api/drafts/${draftId}/versions`)).versions); }
    catch (e) { onError(e instanceof Error ? e.message : '판 기록을 불러오지 못했어요.'); setList([]); }
  }
  return (
    <details className="versions" onToggle={e => { if ((e.target as HTMLDetailsElement).open) void load(); }}>
      <summary>판 기록 <span className="muted small">AI 초안·고친 글·최종 비교, 되돌리기</span></summary>
      {list === null ? <p className="muted small">불러오는 중…</p> : list.length === 0 ? <p className="muted small">아직 남은 판이 없어요. AI 초안을 만들거나 글을 고치면 쌓여요(원고마다 30개).</p> : (
        <ol className="version-list">
          {list.map(v => (
            <li key={v.id}>
              <div className="version-row">
                <span className={`version-kind k-${v.kind}`}>{KIND[v.kind] ?? v.kind}</span>
                <span className="muted small">{when(v.created_at)} · {v.body.replace(/\s/g, '').length.toLocaleString('ko-KR')}자</span>
                <button type="button" className="btn small ghost" aria-expanded={shown === v.id} onClick={() => setShown(shown === v.id ? null : v.id)}>{shown === v.id ? '접기' : '보기'}</button>
                <button type="button" className="btn small" onClick={() => { if (window.confirm(`'${KIND[v.kind]}'(${when(v.created_at)}) 판으로 제목·본문을 되돌릴까요? 지금 글은 되돌리기 알림에서 다시 불러올 수 있어요.`)) onRestore(v); }}>이 판으로</button>
              </div>
              {shown === v.id && <div className="version-body"><b>{v.title || '(제목 없음)'}</b><p>{v.body}</p></div>}
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
