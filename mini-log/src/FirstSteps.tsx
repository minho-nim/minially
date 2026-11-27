import { useState } from 'react';
import { saveUiPrefs, uiPrefs } from './uiPrefs';

// 첫 안내 3단계(Page Flows의 첫 사용 흐름처럼): 원고가 하나도 없을 때 가운데 칸에만 보이고, 화면을 막지 않는다.
// '다 봤어요'·'건너뛰기'는 계정에 기억해 어느 기기에서든 다시 보이지 않는다(원고를 하나 만들어도 사라진다).
const KEY = 'minilog.firstSteps';
const STEPS = [
  { title: '원고를 하나 시작해요', body: '사진을 올리고, 직접 겪은 내용을 몇 줄 적으면 AI가 초안을 써요. 겪지 않은 내용은 지어내지 않고 [작성자 확인 필요]로 비워 둬요.' },
  { title: '밑줄을 따라 다듬어요', body: '본문 위 물결 밑줄과 오른쪽 원고 점검이 고칠 곳을 알려 줘요. ‘다음 문제’를 누르면 그 문장으로 바로 가요.' },
  { title: '올릴 날을 정하고 직접 올려요', body: '캘린더에 게시일을 잡고, 협찬은 마감일과 금액을 적어 두세요. 글은 미니로그가 대신 올리지 않아요. 복사해서 직접 올려요.' },
];

export function FirstSteps({ onNew }: { onNew: () => void }) {
  const [step, setStep] = useState(0);
  const [hidden, setHidden] = useState(() => { const p = uiPrefs(); if (p) return p.steps_done; try { return localStorage.getItem(KEY) === 'done'; } catch { return false; } });
  if (hidden) return null;
  const done = () => { try { localStorage.setItem(KEY, 'done'); } catch { /* 기억 못 해도 됨 */ } setHidden(true); saveUiPrefs({ steps_done: true }).catch(() => { /* 다음에 다시 */ }); };
  const s = STEPS[step];
  return (
    <section className="first-steps" aria-labelledby="fs-title">
      <ol className="fs-dots" aria-label={`첫 안내 ${STEPS.length}단계 중 ${step + 1}단계`}>
        {STEPS.map((x, i) => <li key={x.title} aria-current={i === step ? 'step' : undefined}><button type="button" aria-label={`${i + 1}단계: ${x.title}`} onClick={() => setStep(i)}>{i + 1}</button></li>)}
      </ol>
      <h2 id="fs-title" className="fs-title">{s.title}</h2>
      <p className="fs-body small">{s.body}</p>
      <div className="fs-actions">
        {step === 0 && <button type="button" className="btn primary" onClick={onNew}>첫 원고 시작하기</button>}
        {step < STEPS.length - 1
          ? <button type="button" className={`btn${step === 0 ? ' ghost' : ' primary'}`} onClick={() => setStep(step + 1)}>다음 안내</button>
          : <button type="button" className="btn primary" onClick={done}>다 봤어요</button>}
        {step < STEPS.length - 1 && <button type="button" className="btn ghost" onClick={done}>건너뛰기</button>}
      </div>
    </section>
  );
}
