import React from 'react';
import { ActiveNavTab } from '../../types';
import { Calendar, CheckSquare, Plus, Search, Settings } from 'lucide-react';

interface BottomTabBarProps {
  activeTab: ActiveNavTab;
  onTabChange: (tab: ActiveNavTab) => void;
  onOpenNewScheduleModal: () => void;
  onOpenSearchModal: () => void;
  onOpenSettingsModal: () => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabChange,
  onOpenNewScheduleModal,
  onOpenSearchModal,
  onOpenSettingsModal,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-[#F0E7EB] px-3 pt-1 pb-safe safe-bottom shadow-xs flex items-center justify-around h-16">
      <button
        type="button"
        onClick={() => onTabChange('calendar')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
          activeTab === 'calendar' ? 'text-[#CF8FA8] font-bold' : 'text-[#85777D] hover:text-[#3E3438]'
        }`}
      >
        <Calendar className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">캘린더</span>
      </button>

      <button
        type="button"
        onClick={() => onTabChange('tasks')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
          activeTab === 'tasks' ? 'text-[#CF8FA8] font-bold' : 'text-[#85777D] hover:text-[#3E3438]'
        }`}
      >
        <CheckSquare className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">할 일</span>
      </button>

      {/* Center Quick Add FAB */}
      <button
        type="button"
        onClick={onOpenNewScheduleModal}
        className="-mt-5 w-12 h-12 rounded-full bg-[#CF8FA8] text-white flex items-center justify-center shadow-md hover:bg-[#BD7F98] active:scale-90 transition-all cursor-pointer border-2 border-white shrink-0"
        aria-label="새 일정 등록"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      <button
        type="button"
        onClick={onOpenSearchModal}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer text-[#85777D] hover:text-[#3E3438]"
      >
        <Search className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">검색</span>
      </button>

      <button
        type="button"
        onClick={onOpenSettingsModal}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer text-[#85777D] hover:text-[#3E3438]"
      >
        <Settings className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">설정</span>
      </button>
    </nav>
  );
};
