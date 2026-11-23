import React, { useEffect, useState } from 'react';
import { syncEngine, type SyncStatus } from '../../sync/syncEngine';

// 위쪽 막대의 동기화 상태 점: 초록=맞춤, 깜빡임=맞추는 중, 회색=오프라인, 빨강=오류
const LOOK: Record<SyncStatus['kind'], { color: string; label: string }> = {
  idle: { color: '#6BBF8A', label: 'PC·폰 동기화됨' },
  syncing: { color: '#E0B04A', label: '맞추는 중' },
  offline: { color: '#A69BA1', label: '오프라인: 다시 연결되면 자동으로 맞춰요' },
  error: { color: '#D9534F', label: '동기화 오류: 설정 → 백업/복원에서 확인하세요' },
  off: { color: 'transparent', label: '' },
};

export const SyncDot: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const [status, setStatus] = useState<SyncStatus>(syncEngine.getStatus());
  useEffect(() => syncEngine.subscribe(setStatus), []);
  if (status.kind === 'off') return null;
  const look = LOOK[status.kind];
  const label = status.kind === 'error' ? `동기화 오류: ${status.message}` : look.label;
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} data-sync-status={status.kind} className="relative inline-flex items-center justify-center w-6 h-6 rounded-full cursor-pointer hover:bg-app-soft">
      <span className={`w-2 h-2 rounded-full ${status.kind === 'syncing' ? 'animate-pulse' : ''}`} style={{ background: look.color }} />
    </button>
  );
};
