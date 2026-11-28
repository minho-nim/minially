import { useEffect, useState } from 'react';
import { api } from '../../shared/client/api';

// 아침 브리핑 카드(첫 화면)와 아침 알림 켜기(설정). 할 일은 서버가 규칙으로 고른다(AI 없음).
type Kind = 'deadline' | 'apply' | 'reply' | 'suggest' | 'post' | 'event';
interface BriefItem { kind: Kind; title: string; sub: string; target: 'campaigns' | 'mail' | 'drafts' | 'calendar' }
interface Brief { today: string; items: BriefItem[]; counts: { posted_week: number; receivable: number; waiting: number; suggest: number; events?: number } }
const won = (n: number) => (n >= 10000 ? `${Math.round(n / 1000) / 10}만` : n.toLocaleString('ko-KR'));
const dayLabel = (d: string) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));

/** 휴대폰 폭(839px 이하)인지. 휴대폰은 첫 화면이 원고 목록이라 브리핑 카드를 목록 위에 둔다 */
export function usePhone() {
  const q = '(max-width: 839px)';
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setPhone(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return phone;
}

export function BriefCard({ name, onGo }: { name: string; onGo: (target: BriefItem['target']) => void }) {
  const [brief, setBrief] = useState<Brief | null>(null);
  useEffect(() => { let alive = true; api<Brief>('/api/brief').then(b => { if (alive) setBrief(b); }).catch(() => { /* 카드만 안 보임 */ }); return () => { alive = false; }; }, []);
  if (!brief) return null;
  const top = brief.items.slice(0, 3);
  const c = brief.counts;
  return (
    <section className="brief" aria-labelledby="brief-title">
      <div className="brief-head"><h2 id="brief-title">좋은 하루예요{name ? `, ${name}님` : ''}</h2><span className="muted small">{dayLabel(brief.today)}</span></div>
      <div className="brief-grid">
        <div className="brief-today">
          <h3>{top.length ? `오늘 할 일 ${brief.items.length}개` : '오늘 급한 일은 없어요'}</h3>
          {top.length > 0 ? (
            <ol>
              {top.map((it, i) => (
                <li key={`${it.kind}-${i}`}>
                  <span className="brief-n" aria-hidden="true">{i + 1}</span>
                  <span className="brief-t">{it.title}<small>{it.sub}</small></span>
                  <button type="button" className="btn small" onClick={() => onGo(it.target)} aria-label={`열기: ${it.title}`}>열기</button>
                </li>
              ))}
            </ol>
          ) : <p className="small" style={{ margin: 0 }}>마감·답장·오늘 올릴 원고가 없어요. 글감에서 다음 글을 골라 볼까요?</p>}
          {brief.items.length > 3 && <p className="small brief-more">그 밖에 {brief.items.length - 3}개 더 있어요</p>}
        </div>
        <div className="brief-kpis" aria-label="숫자 요약">
          <div><span className="muted small">이번 주 게시</span><b>{c.posted_week}</b></div>
          <div><span className="muted small">받을 금액</span><b>{c.receivable ? `${won(c.receivable)}원` : '0원'}</b></div>
          <div><span className="muted small">답장 기다림</span><b>{c.waiting}</b></div>
          <div><span className="muted small">단계 확인</span><b>{c.suggest}</b></div>
        </div>
      </div>
    </section>
  );
}

const b64ToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), ch => ch.charCodeAt(0));
const bytesToB64 = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };

/** 설정: 이 기기에서 아침 알림 켜기/끄기. 키가 아직 없으면 관리자용 키 만들기(이 기기 안에서만 만들고 서버로 보내지 않음) */
export function PushCard() {
  const [info, setInfo] = useState<{ public_key: string | null; devices: number } | null>(null);
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [made, setMade] = useState<{ pub: string; priv: string } | null>(null);
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  useEffect(() => {
    api<{ public_key: string | null; devices: number }>('/api/push').then(setInfo).catch(() => setInfo({ public_key: null, devices: 0 }));
    if (supported) navigator.serviceWorker.getRegistration().then(r => r?.pushManager.getSubscription()).then(s => setOn(!!s)).catch(() => setOn(false));
  }, [supported]);

  async function enable() {
    if (!info?.public_key) return;
    setBusy(true); setMsg(null);
    try {
      if ((await Notification.requestPermission()) !== 'granted') throw new Error('알림 허용을 눌러 주세요. 막았다면 브라우저 설정에서 미니로그 알림을 허용해 주세요.');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(info.public_key) });
      await api('/api/push', { body: sub.toJSON() });
      setOn(true); setInfo(i => i && { ...i, devices: i.devices + 1 });
      setMsg({ kind: 'info', text: '아침 알림을 켰어요. 할 일이 있는 날 아침에 한 번 알려 드려요.' });
    } catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : '알림을 켜지 못했어요.' }); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true); setMsg(null);
    try {
      const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      if (sub) { await api('/api/push', { method: 'DELETE', body: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
      setOn(false); setInfo(i => i && { ...i, devices: Math.max(0, i.devices - 1) });
      setMsg({ kind: 'info', text: '이 기기의 아침 알림을 껐어요.' });
    } catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : '알림을 끄지 못했어요.' }); }
    finally { setBusy(false); }
  }
  async function makeKeys() {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    setMade({ pub: bytesToB64(pub), priv: jwk.d ?? '' });
  }

  return (
    <section className="card step" aria-labelledby="push-title">
      <h2 id="push-title" className="step-title">아침 알림</h2>
      <p className="small" style={{ margin: 0 }}>매일 아침 8시 30분쯤, 할 일(마감·답장·오늘 올릴 원고·오늘 일정)이 있으면 이 기기로 한 번 알려요. 알림에는 할 일 제목만 보이고 메일 내용·금액은 넣지 않아요.</p>
      {!supported ? <p className="muted small" style={{ margin: 0 }}>이 브라우저는 알림을 받을 수 없어요. 아이폰은 사파리에서 '홈 화면에 추가'로 미니로그를 설치한 뒤 그 앱에서 켜 주세요.</p>
        : info && !info.public_key ? (
          <div className="stack" style={{ gap: 6 }}>
            <p className="muted small" style={{ margin: 0 }}>알림 키가 아직 없어요. 관리자가 아래에서 키를 만들어 Cloudflare(mini-log → 설정 → 변수와 비밀)에 비밀로 넣으면 켤 수 있어요.</p>
            {!made ? <button type="button" className="btn small" onClick={() => { void makeKeys(); }} style={{ justifySelf: 'start' }}>알림 키 만들기(관리자)</button> : (
              <div className="push-keys" aria-label="새 알림 키">
                <label className="small" htmlFor="vapid-pub">VAPID_PUBLIC_KEY</label><input id="vapid-pub" className="input" readOnly value={made.pub} onFocus={e => e.currentTarget.select()} />
                <label className="small" htmlFor="vapid-priv">VAPID_PRIVATE_KEY(비밀, 채팅에 붙이지 마세요)</label><input id="vapid-priv" className="input" readOnly value={made.priv} onFocus={e => e.currentTarget.select()} />
                <p className="muted small" style={{ margin: 0 }}>이 키는 이 기기에서만 만들었고 서버에 보내지 않았어요. 두 값을 넣은 뒤 이 창을 닫으면 다시 볼 수 없어요.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="ai-row">
            {on ? <button type="button" className="btn" onClick={() => { void disable(); }} disabled={busy}>이 기기 알림 끄기</button>
              : <button type="button" className="btn primary" onClick={() => { void enable(); }} disabled={busy || !info}>이 기기에서 아침 알림 켜기</button>}
            <span className="muted small">{on ? '이 기기는 켜져 있어요' : '이 기기는 꺼져 있어요'}{info ? ` · 알림 켠 기기 ${info.devices}대` : ''}</span>
          </div>
        )}
      {msg && <p className={msg.kind === 'error' ? 'error small' : 'muted small'} role={msg.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0 }}>{msg.text}</p>}
    </section>
  );
}
