import React, { useEffect, useState } from 'react';
import { Link2, RefreshCw, Unlink } from 'lucide-react';
import { syncEngine, confirmAndLogout, type SyncStatus } from '../../sync/syncEngine';

function timeLabel(at?: number) {
  if (!at) return '';
  const diff = Math.round((Date.now() - at) / 1000);
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  return new Date(at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusText(status: SyncStatus) {
  switch (status.kind) {
    case 'syncing': return '맞추는 중…';
    case 'idle': return `연결됨 · ${status.lastSyncedAt ? `${timeLabel(status.lastSyncedAt)} 맞춤` : '대기 중'}`;
    case 'offline': return '인터넷이 끊겼어요. 다시 연결되면 자동으로 맞춰요.';
    case 'error': return `맞추지 못했어요: ${status.message}`;
    default: return '';
  }
}

export const SyncPanel: React.FC<{ variant?: 'settings' | 'login' }> = ({ variant = 'settings' }) => {
  const login = variant === 'login';
  const [status, setStatus] = useState<SyncStatus>(syncEngine.getStatus());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [choice, setChoice] = useState<string | null>(null);

  useEffect(() => syncEngine.subscribe(setStatus), []);

  const connect = async (mode: 'merge' | 'server', value = code) => {
    setBusy(true); setMessage('');
    try {
      await syncEngine.connect(value, mode);
      setCode(''); setChoice(null);
      setMessage(mode === 'server' ? '서버 데이터를 불러왔어요.' : '로그인했어요. 이 기기 데이터를 서버에 올렸어요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '연결하지 못했어요.');
    } finally { setBusy(false); }
  };

  const start = async () => {
    setBusy(true); setMessage(''); setChoice(null);
    try {
      const info = await syncEngine.inspect(code);
      if (info.serverHasData && info.localHasData) { setChoice(info.code); setBusy(false); return; }
      await connect(info.serverHasData ? 'server' : 'merge', info.code);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '연결하지 못했어요.');
      setBusy(false);
    }
  };

  const connected = status.kind !== 'off';

  return (
    <div className="p-3.5 border border-app-line bg-app-canvas rounded-xl space-y-2.5" aria-label="기기 연결">
      <div className="flex items-center gap-1.5">
        <Link2 className="w-4 h-4 text-app-accent" />
        <h4 className="text-sm font-bold text-app-ink">{login ? '코드로 로그인' : '로그인·기기 연결'}</h4>
      </div>

      {connected ? (
        <>
          <p role="status" className={`text-xs ${status.kind === 'error' ? 'text-red-600' : 'text-app-muted'}`}>{statusText(status)}</p>
          <p className="text-[11px] text-app-muted">로그인되어 있어요. 같은 코드로 로그인한 기기끼리 일정·할 일·문구·카테고리·설정이 자동으로 맞춰져요.</p>
          <div className="flex gap-2">
            <button type="button" disabled={status.kind === 'syncing'} onClick={() => void syncEngine.syncNow()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg bg-app-accent text-white disabled:opacity-60 cursor-pointer">
              <RefreshCw className={`w-3.5 h-3.5 ${status.kind === 'syncing' ? 'animate-spin' : ''}`} /> 지금 맞추기
            </button>
            <button type="button" disabled={busy} onClick={async () => {
              setBusy(true); setMessage('');
              if (!(await confirmAndLogout())) setBusy(false);
            }} className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-app-line text-app-muted hover:text-app-ink disabled:opacity-60 cursor-pointer">
              <Unlink className="w-3.5 h-3.5" /> 로그아웃
            </button>
          </div>
        </>
      ) : choice ? (
        <div className="space-y-2">
          <p className="text-xs text-app-ink">서버와 이 기기에 모두 데이터가 있어요. 어떻게 할까요?</p>
          <button type="button" disabled={busy} onClick={() => void connect('merge', choice)}
            className="w-full text-left p-2.5 rounded-lg border border-app-line bg-white hover:bg-app-soft disabled:opacity-60 cursor-pointer">
            <p className="text-xs font-bold text-app-ink">합치기 (추천)</p>
            <p className="text-[11px] text-app-muted">이 기기 데이터와 서버 데이터를 모두 남겨요.</p>
          </button>
          <button type="button" disabled={busy} onClick={() => { if (window.confirm('이 기기 데이터를 지우고 서버 데이터로 바꿀까요?')) void connect('server', choice); }}
            className="w-full text-left p-2.5 rounded-lg border border-app-line bg-white hover:bg-app-soft disabled:opacity-60 cursor-pointer">
            <p className="text-xs font-bold text-app-ink">서버 데이터로 바꾸기</p>
            <p className="text-[11px] text-app-muted">이 기기 데이터는 지우고 서버 데이터만 써요.</p>
          </button>
          <button type="button" disabled={busy} onClick={() => setChoice(null)} className="text-[11px] text-app-muted underline cursor-pointer">취소</button>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-app-muted">받은 코드를 입력하세요. 한 번 로그인하면 이 기기에 저장되어 다음부터 자동으로 로그인돼요. 같은 코드를 쓰는 PC와 폰은 데이터가 자동으로 맞춰져요.</p>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (!busy && code.trim()) void start(); }}>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="코드" aria-label="연결 코드"
              autoComplete="off" autoCapitalize="characters" spellCheck={false}
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-app-line bg-white tracking-wider uppercase" />
            <button type="submit" disabled={busy || !code.trim()}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-app-accent text-white disabled:opacity-60 cursor-pointer">
              {busy ? '확인 중…' : login ? '로그인' : '연결'}
            </button>
          </form>
        </>
      )}
      {message && <p role="status" className="text-xs text-app-muted">{message}</p>}
    </div>
  );
};
