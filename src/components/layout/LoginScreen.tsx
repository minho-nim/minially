import React from 'react';
import { SyncPanel } from '../common/SyncPanel';

// 코드 로그인 화면. 로그인 전에는 앱을 쓸 수 없다. 로그인하면 코드가 이 기기에 저장되어 다음부터 자동 로그인.
export const LoginScreen: React.FC = () => (
  <div className="app-modal min-h-dvh bg-app-canvas flex items-center justify-center p-4">
    <div className="w-full max-w-sm space-y-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="w-14 h-14" />
        <h1 className="text-xl font-bold text-app-ink">미니어리</h1>
        <p className="text-xs text-app-muted">받은 코드로 로그인하세요.</p>
      </div>
      <div className="bg-white rounded-2xl shadow-xl border border-app-line p-4" role="dialog" aria-label="연결 코드 입력">
        <SyncPanel variant="login" />
      </div>
    </div>
  </div>
);

/** 로그인 없이 열어야 하는 개발용 시험에서만 쓰는 우회(운영 빌드에서는 무시). */
export function devSkipLogin() {
  if (!import.meta.env.DEV) return false;
  try { return localStorage.getItem('minially-sync-skip') === '1'; } catch { return false; }
}
