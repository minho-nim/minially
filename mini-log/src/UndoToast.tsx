import { useEffect, useRef, useState } from 'react';

// '되돌리기' 알림(Material 3 스낵바처럼): 지운 뒤 확인 창 대신 아래에 잠깐 띄운다. 8초 뒤 사라지고, 서버 휴지통은 10분 동안 되돌릴 수 있다.
type Undo = { text: string; undo: () => Promise<void>; id: number };
const EVENT = 'minilog-undo';
let seq = 0;
export function showUndo(text: string, undo: () => Promise<void>) {
  window.dispatchEvent(new CustomEvent<Undo>(EVENT, { detail: { text, undo, id: ++seq } }));
}

export function UndoToast() {
  const [item, setItem] = useState<Undo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Undo>).detail;
      setItem(d); setError(''); setBusy(false);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setItem(cur => (cur?.id === d.id ? null : cur)), 8000);
    };
    window.addEventListener(EVENT, on);
    return () => { window.removeEventListener(EVENT, on); window.clearTimeout(timer.current); };
  }, []);
  if (!item) return null;
  const run = async () => {
    setBusy(true); setError('');
    try { await item.undo(); setItem(null); }
    catch (e) { setError(e instanceof Error ? e.message : '되돌리지 못했어요.'); setBusy(false); }
  };
  return (
    <div className="undo-toast" role="status">
      <span>{error || item.text}</span>
      {!error && <button type="button" className="undo-btn" disabled={busy} onClick={() => { void run(); }}>{busy ? '되돌리는 중…' : '되돌리기'}</button>}
      <button type="button" className="undo-close" aria-label="알림 닫기" onClick={() => setItem(null)}>×</button>
    </div>
  );
}
