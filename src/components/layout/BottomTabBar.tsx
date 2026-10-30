import React from 'react';
import { ActiveNavTab } from '../../types';
import { Calendar, CheckSquare, Search, Settings } from 'lucide-react';
interface BottomTabBarProps {
 activeTab: ActiveNavTab;
 onTabChange: (tab: ActiveNavTab) => void;
 onOpenSearchModal: () => void;
 onOpenSettingsModal: () => void;
}
export const BottomTabBar: React.FC<BottomTabBarProps> = ({activeTab,onTabChange,onOpenSearchModal,onOpenSettingsModal}) => {
 const items=[
  {id:'calendar',label:'캘린더',icon:Calendar,onClick:()=>onTabChange('calendar')},
  {id:'tasks',label:'할 일',icon:CheckSquare,onClick:()=>onTabChange('tasks')},
  {id:'search',label:'검색',icon:Search,onClick:onOpenSearchModal},
  {id:'settings',label:'설정',icon:Settings,onClick:onOpenSettingsModal},
 ];
 return <nav aria-label="하단 메뉴" className="mobile-bottom-nav md:hidden fixed left-1/2 -translate-x-1/2 z-30 grid grid-cols-4 items-stretch gap-1 rounded-full border border-[#E9DDE3] bg-white/95 backdrop-blur-lg">
  {items.map(({id,label,icon:Icon,onClick})=><button key={id} type="button" onClick={onClick} aria-current={activeTab===id?'page':undefined} aria-haspopup={id==='search'||id==='settings'?'dialog':undefined} className={'min-w-0 min-h-11 flex flex-col items-center justify-center gap-0.5 rounded-full transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#BD7F98] focus-visible:outline-offset-2 '+(activeTab===id?'bg-[#F6E8ED] text-[#8F526C] font-semibold':'text-[#85777D] hover:bg-[#FFFAFB] hover:text-[#3E3438]')}><Icon aria-hidden="true" className="w-5 h-5"/><span className="text-[11px]">{label}</span></button>)}
 </nav>;
};
