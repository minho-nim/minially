import { useEffect, useState } from 'react';
import { api } from '../../shared/client/api';
import { Help } from './Help';

// 휴대폰 달력 구독: 주소를 한 번 등록하면 협찬 마감·방문일·게시 예정·다시 연락할 날이 기본 달력에 뜨고 전날 오전 9시에 알림
export function CalendarFeed() {
  const [on, setOn] = useState<boolean | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  useEffect(() => { api<{ on: boolean }>('/api/calendar/feed').then(d => setOn(d.on)).catch(() => setOn(false)); }, []);

  async function make() {
    if (on && !window.confirm('새 주소를 만들면 지금 등록한 주소는 더 이상 갱신되지 않아요. 만들까요?')) return;
    setBusy(true); setMessage(null);
    try { const d = await api<{ url: string }>('/api/calendar/feed', { method: 'POST' }); setUrl(d.url); setOn(true); }
    catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '만들지 못했어요.' }); }
    finally { setBusy(false); }
  }
  async function off() {
    if (!window.confirm('달력 구독을 끌까요? 등록한 달력에서 일정이 더 이상 갱신되지 않아요.')) return;
    setBusy(true);
    try { await api('/api/calendar/feed', { method: 'DELETE' }); setOn(false); setUrl(''); setMessage({ kind: 'info', text: '구독을 껐어요. 달력 앱에서 구독도 지워 주세요.' }); }
    catch (e) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : '끄지 못했어요.' }); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setMessage({ kind: 'info', text: '주소를 복사했어요.' }); }
    catch { setMessage({ kind: 'error', text: '복사하지 못했어요. 주소를 길게 눌러 복사해 주세요.' }); }
  }
  const webcal = url.replace(/^https?:/, 'webcal:');

  return (
    <section className="card step" aria-labelledby="feed-title">
      <div className="row-between">
        <h2 id="feed-title" className="step-title">휴대폰 달력에 알림 받기<span className="step-sub">{on === null ? '' : on ? '켜짐' : '꺼짐'}</span></h2>
        <div className="ai-row">
          <button className="btn small" onClick={() => { void make(); }} disabled={busy || on === null}>{on ? '새 주소 만들기' : '구독 주소 만들기'}</button>
          {on && <button className="btn ghost small" onClick={() => { void off(); }} disabled={busy}>끄기</button>}
        </div>
      </div>
      <Help short="협찬 마감·방문일·게시 예정·다시 연락할 날을 기본 달력에, 전날 오전 9시 알림.">
        아이폰은 아래 '달력에 추가'를 누르거나 설정 → 캘린더 → 계정 → 구독 캘린더 추가에 주소를 붙여 넣어요. 안드로이드는 구글 캘린더(PC) → 다른 캘린더 + → URL로 추가에 붙여 넣어요. 달력 앱이 몇 시간마다 새로 가져가요. 주소는 비밀번호처럼 다뤄 주세요(금액·메모는 들어가지 않아요). 주소는 만들 때 한 번만 보여요.
      </Help>
      {url && (
        <div className="feed-url">
          <input className="input" aria-label="구독 주소" readOnly value={url} onFocus={e => e.currentTarget.select()} />
          <div className="ai-row">
            <button className="btn small" onClick={() => { void copy(); }}>주소 복사</button>
            <a className="btn small primary" href={webcal}>달력에 추가</a>
          </div>
        </div>
      )}
      {message && <p className={message.kind === 'error' ? 'error' : 'muted small'} role={message.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{message.text}</p>}
    </section>
  );
}
