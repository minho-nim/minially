import React, { useEffect, useState } from 'react';
import { SyncPanel } from '../common/SyncPanel';
import { syncEngine } from '../../sync/syncEngine';

// 처음 열 때 한 번만 연결 코드를 묻는다. 연결하면 코드는 이 기기에 저장되어 다음부터 자동으로 연결된다.
const SKIP_KEY = 'minially-sync-skip';

function skipped() {
  try { return localStorage.getItem(SKIP_KEY) === '1'; } catch { return false; }
}

export const FirstRunSyncModal: React.FC = () => {
  const [open, setOpen] = useState(() => !syncEngine.connected && !skipped());

  // 연결되면(합치기·바꾸기 선택까지 끝나면) 닫는다.
  useEffect(() => syncEngine.subscribe(status => { if (status.kind !== 'off') setOpen(false); }), []);

  if (!open) return null;

  const skip = () => {
    try { localStorage.setItem(SKIP_KEY, '1'); } catch { /* 저장 못 해도 이번에는 닫음 */ }
    setOpen(false);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="연결 코드 입력" className="app-modal fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-app-line p-4 space-y-3">
        <div>
          <h3 className="text-base font-bold text-app-ink">미니어리 시작하기</h3>
          <p className="text-xs text-app-muted mt-1">받은 연결 코드를 입력하세요. 한 번 입력하면 이 기기에 저장되어 다음부터는 자동으로 연결돼요.</p>
        </div>
        <SyncPanel />
        <button type="button" onClick={skip} className="w-full text-[11px] text-app-muted underline cursor-pointer">
          코드 없이 이 기기에서만 쓰기 (나중에 설정 → 백업/복원에서 연결할 수 있어요)
        </button>
      </div>
    </div>
  );
};
