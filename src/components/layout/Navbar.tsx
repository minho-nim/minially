import React from 'react';
import { ActiveNavTab } from '../../types';
import { Search, Settings, Calendar, CheckSquare, Plus, Download } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface NavbarProps {
  activeTab: ActiveNavTab;
  onTabChange: (tab: ActiveNavTab) => void;
  onOpenNewScheduleModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenSearchModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenNewScheduleModal,
  onOpenSettingsModal,
  onOpenSearchModal,
}) => {
  const { isInstallable, promptInstall } = usePWAInstall();

  return (
    <header className="sticky top-0 z-30 bg-[#FFFAFB]/95 backdrop-blur-md border-b border-[#F0E7EB] safe-top transition-all">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2 select-none shrink-0">
          <div className="w-6 h-6 rounded-md bg-[#CF8FA8] text-white flex items-center justify-center font-bold text-xs shadow-2xs">M</div>
          <span className="text-base font-bold tracking-tight text-[#3E3438]">
            미니<span className="text-[#CF8FA8]">어리</span>
          </span>
        </div>

        {/* 2 Main Tabs: Segmented Control */}
        <div className="flex items-center p-0.5 bg-[#F6E8ED] rounded-xl border border-[#F0E7EB]">
          <button
            type="button"
            onClick={() => onTabChange('calendar')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-white text-[#3E3438] shadow-2xs'
                : 'text-[#85777D] hover:text-[#3E3438]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#CF8FA8]" />
            <span>캘린더</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('tasks')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-white text-[#3E3438] shadow-2xs'
                : 'text-[#85777D] hover:text-[#3E3438]'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-[#CF8FA8]" />
            <span>할 일</span>
          </button>
        </div>

        {/* Action icons: Search, PWA, Settings */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onOpenSearchModal}
            className="w-9 h-9 flex items-center justify-center text-[#85777D] hover:text-[#3E3438] hover:bg-[#F6E8ED] rounded-xl transition-colors cursor-pointer"
            title="일정 검색"
            aria-label="일정 검색"
          >
            <Search className="w-4 h-4" />
          </button>

          {isInstallable && (
            <button
              type="button"
              onClick={promptInstall}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#CF8FA8] bg-white border border-[#F0E7EB] hover:bg-[#F6E8ED] rounded-lg transition-colors cursor-pointer"
              title="앱 설치"
            >
              <Download className="w-3.5 h-3.5" />
              <span>설치</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettingsModal}
            className="w-9 h-9 flex items-center justify-center text-[#85777D] hover:text-[#3E3438] hover:bg-[#F6E8ED] rounded-xl transition-colors cursor-pointer"
            title="설정 및 프리셋"
            aria-label="설정 및 프리셋"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenNewScheduleModal}
            className="hidden md:flex items-center gap-1 ml-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#CF8FA8] hover:bg-[#BD7F98] rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>등록</span>
          </button>
        </div>
      </div>
    </header>
  );
};
