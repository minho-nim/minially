// 초안 전 질문: AI(또는 규칙)가 경험 글에 빠진 사실을 3~5개 묻고, 답한 것만 경험 글에 붙여 AI 초안을 만든다.
import { useState } from 'react';
import { api } from '../../shared/client/api';
import { appendAnswers, type DraftQuestion } from '../functions/_questions';

export function DraftQuestions({ draftId, experience, postType, disabled, canGenerate, onReady, onError }: {
  draftId: string; experience: string; postType: string; disabled: boolean;
  /** Gemini 키가 없으면 질문(기본 질문)만 받고, 답은 경험 글에만 넣는다 */
  canGenerate: boolean;
  /** 답을 붙인 경험 글(키가 있으면 이어서 초안 만들기) */
  onReady: (experience: string) => void; onError: (text: string) => void;
}) {
  const [questions, setQuestions] = useState<DraftQuestion[] | null>(null);
  const [source, setSource] = useState<'ai' | 'rule'>('ai');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (experience.trim().length < 10) { onError('실제 방문·사용 경험을 10자 이상 적어 주세요.'); return; }
    setBusy(true);
    try {
      const r = await api<{ questions: DraftQuestion[]; source: 'ai' | 'rule' }>(`/api/drafts/${draftId}/questions`, { body: { experience, post_type: postType } });
      setQuestions(r.questions); setSource(r.source); setAnswers({});
    } catch (e) { onError(e instanceof Error ? e.message : '질문을 받지 못했어요.'); }
    finally { setBusy(false); }
  }

  const answered = questions ? questions.filter((_, i) => (answers[i] ?? '').trim()).length : 0;
  return <div className="draft-questions">
    {!questions && <button type="button" className="btn" onClick={() => { void ask(); }} disabled={disabled || busy}>{busy ? '질문 고르는 중…' : '먼저 질문 받기'}</button>}
    {questions && <section className="card" aria-label="초안 전 질문" style={{ display: 'grid', gap: 10 }}>
      <p className="small" style={{ margin: 0 }}>
        {questions.length ? <><b>초안 전에 몇 가지만 알려 주세요.</b> 답한 것만 경험 글에 붙여서 써요{source === 'rule' ? '(AI 연결이 안 돼 기본 질문으로 물어요)' : ''}.</> : <b>더 물어볼 게 없어요. 바로 초안을 만들어도 돼요.</b>}
      </p>
      {questions.map((q, i) => <div className="field" key={q.q}>
        <label htmlFor={`dq-${i}`}>{q.q}</label>
        {q.why && <span className="muted small">{q.why}</span>}
        <input id={`dq-${i}`} className="input" maxLength={300} value={answers[i] ?? ''} onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))} placeholder="모르면 비워 두세요" />
      </div>)}
      <div className="row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn primary" disabled={disabled || (!canGenerate && !answered)} onClick={() => { setQuestions(null); onReady(appendAnswers(experience, (questions ?? []).map((q, i) => ({ q: q.q, a: answers[i] ?? '' })))); }}>
          {canGenerate ? (answered ? `답 ${answered}개 넣고 AI로 초안 만들기` : '그냥 AI로 초안 만들기') : `답 ${answered}개 경험 글에 넣기`}
        </button>
        <button type="button" className="btn ghost" onClick={() => setQuestions(null)}>닫기</button>
      </div>
    </section>}
  </div>;
}
