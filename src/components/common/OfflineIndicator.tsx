import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="bg-[#CF8FA8] text-white text-xs px-3 py-1 flex items-center justify-center gap-1.5 shadow-2xs transition-all">
      <WifiOff className="w-3.5 h-3.5" />
      <span>오프라인 상태입니다. 모든 변경사항은 로컬에 안전하게 저장됩니다.</span>
    </div>
  );
};
