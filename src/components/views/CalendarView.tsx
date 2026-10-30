import { CalendarDateMenu } from '../common/CalendarDateMenu';
import { compareSchedules } from '../../utils/scheduleOrder';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Schedule,
  ScheduleCategory,
  CategoryItem,
  AppSettings,
} from '../../types';
import {
  formatKoreanDate,
  formatShortDate,
  getTodayDateString,
  DAYS_KR,
} from '../../utils/dateHelpers';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  Circle,
  Copy,
  ArrowRight,
  Trash2,
  MoreVertical,
  CalendarRange,
  Edit2,
  Star,
} from 'lucide-react';

interface CalendarViewProps {
  schedules: Schedule[];
  categories: CategoryItem[];
  settings: AppSettings;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenDay: (date: string) => void;
  onOpenNewScheduleModal: (defaultDate?: string) => void;
  onEditSchedule: (schedule: Schedule) => void;
  onToggleSchedule: (scheduleId: string) => void;
  onMoveSchedule: (scheduleId: string, newDate: string) => void;
  onDeleteSchedule: (scheduleId: string) => void;
  onOpenDateCopyModal: (sourceDate: string) => void;
  onOpenBatchDateModal: (defaultDate: string) => void;
  onOpenMoveModal: (schedule: Schedule) => void;
  onOpenPresetModal: () => void;
}

type CalendarMode = 'month' | 'week';

export const CalendarView: React.FC<CalendarViewProps> = ({
  schedules,
  categories,
  settings,
  selectedDate,
  onSelectDate, onOpenDay,
  onOpenNewScheduleModal,
  onEditSchedule,
  onToggleSchedule,
  onMoveSchedule,
  onDeleteSchedule,
  onOpenDateCopyModal,
  onOpenBatchDateModal,
  onOpenMoveModal,
  onOpenPresetModal,
}) => {
  const todayStr = getTodayDateString();
  const [viewMode, setViewMode] = useState<CalendarMode>(settings.defaultView || 'month');
  const [activeDateMenu, setActiveDateMenu] = useState<string | null>(null);
  const dateMenuAnchor = useRef<HTMLButtonElement|null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const [viewDate, setViewDate] = useState<Date>(() => {
    const [y, m, d] = (selectedDate || todayStr).split('-').map(Number);
    return new Date(y, m - 1, d || 1);
  });

  useEffect(() => { const [y, m, d] = selectedDate.split('-').map(Number); setViewDate(new Date(y, m - 1, d)); }, [selectedDate]);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryItem>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  // Filtered schedules for calendar
  const visibleSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (!settings.showCompletedInCalendar && s.completed) return false;
      return true;
    });
  }, [schedules, settings.showCompletedInCalendar]);

  // Group by date
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of visibleSchedules) {
      const arr = map.get(s.date) || [];
      arr.push(s);
      map.set(s.date, arr);
    }
    for (const [, arr] of map.entries()) {
      arr.sort(compareSchedules);
    }
    return map;
  }, [visibleSchedules]);

  // Schedules for selected date
  const selectedDateSchedules = useMemo(() => {
    return schedules
      .filter((s) => s.date === selectedDate)
      .sort(compareSchedules);
  }, [schedules, selectedDate]);

  // Month navigation
  const handlePrev = () => {
    if (viewMode === 'month') {
      const day = Math.min(Number(selectedDate.slice(-2)), new Date(year, month, 0).getDate());
      const next = new Date(year, month - 1, day);
      onSelectDate(next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0'));
    } else {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      onSelectDate(str);
      setViewDate(new Date(d));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      const day = Math.min(Number(selectedDate.slice(-2)), new Date(year, month + 2, 0).getDate());
      const next = new Date(year, month + 1, day);
      onSelectDate(next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0'));
    } else {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() + 7);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      onSelectDate(str);
      setViewDate(new Date(d));
    }
  };

  const handleGoToday = () => {
    setViewDate(new Date());
    onSelectDate(todayStr);
  };

  const startDayOffset = settings.startDayOfWeek; // 0: Sun, 1: Mon

  // Month days array
  const monthDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startingDayOfWeek = firstDay.getDay() - startDayOffset;
    if (startingDayOfWeek < 0) startingDayOfWeek += 7;

    const daysInMonth = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Leading days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const pDay = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, pDay);
      const mStr = String(prevDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(pDay).padStart(2, '0');
      const dateStr = `${prevDate.getFullYear()}-${mStr}-${dStr}`;
      days.push({
        dateStr,
        dayNum: pDay,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Trailing days
    const remaining = (7 - (days.length % 7)) % 7;
    for (let n = 1; n <= remaining; n++) {
      const nextDate = new Date(year, month + 1, n);
      const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(n).padStart(2, '0');
      const dateStr = `${nextDate.getFullYear()}-${mStr}-${dStr}`;
      days.push({
        dateStr,
        dayNum: n,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [year, month, todayStr, startDayOffset]);

  // Week days array
  const weekDays = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    let dayOfWeek = base.getDay() - startDayOffset;
    if (dayOfWeek < 0) dayOfWeek += 7;

    const startOfWeek = new Date(base);
    startOfWeek.setDate(base.getDate() - dayOfWeek);

    const days: { dateStr: string; dayNum: number; dayName: string; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const curr = new Date(startOfWeek);
      curr.setDate(startOfWeek.getDate() + i);
      const cy = curr.getFullYear();
      const cm = String(curr.getMonth() + 1).padStart(2, '0');
      const cd = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${cy}-${cm}-${cd}`;
      days.push({
        dateStr,
        dayNum: curr.getDate(),
        dayName: DAYS_KR[curr.getDay()],
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [selectedDate, todayStr, startDayOffset]);

  const weekdayLabels = useMemo(() => {
    if (startDayOffset === 1) {
      return ['월', '화', '수', '목', '금', '토', '일'];
    }
    return ['일', '월', '화', '수', '목', '금', '토'];
  }, [startDayOffset]);

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, scheduleId: string) => {
    e.dataTransfer.setData('text/plain', scheduleId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDate !== dateStr) setDragOverDate(dateStr);
  };

  const handleDragLeave = (e: React.DragEvent, dateStr: string) => {
    if (dragOverDate === dateStr) setDragOverDate(null);
  };

  const handleDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const scheduleId = e.dataTransfer.getData('text/plain');
    if (scheduleId && targetDate) {
      onMoveSchedule(scheduleId, targetDate);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div role="group" aria-label="일정 만들기" className="flex justify-end gap-2">
        <button type="button" onClick={() => onOpenPresetModal()} className="min-h-11 px-4 rounded-xl border border-[#E9CDD8] bg-white text-sm text-[#AD728B]">프리셋</button>
        <button type="button" onClick={() => onOpenNewScheduleModal(selectedDate)} className="min-h-11 px-4 rounded-xl bg-[#CF8FA8] text-white text-sm font-semibold">일정 등록</button>
      </div>
      {/* Month/Week Navigation & Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 sm:px-2 pt-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 text-[#85777D] hover:text-[#3E3438] hover:bg-[#F6E8ED] rounded-lg transition-colors cursor-pointer"
              title="이전"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-[#3E3438] px-1 select-none min-w-[120px] text-center">
              {viewMode === 'month'
                ? `${year}년 ${month + 1}월`
                : `${formatShortDate(weekDays[0]?.dateStr || selectedDate)} ~ ${formatShortDate(weekDays[6]?.dateStr || selectedDate)}`}
            </h2>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 text-[#85777D] hover:text-[#3E3438] hover:bg-[#F6E8ED] rounded-lg transition-colors cursor-pointer"
              title="다음"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoToday}
            className="px-2.5 py-1 text-xs font-semibold text-[#CF8FA8] bg-white border border-[#F0E7EB] hover:bg-[#F6E8ED] rounded-lg transition-colors cursor-pointer"
          >
            오늘
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center p-0.5 bg-[#F6E8ED] rounded-lg border border-[#F0E7EB] text-xs">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
              viewMode === 'month'
                ? 'bg-white text-[#3E3438] shadow-2xs font-semibold'
                : 'text-[#85777D] hover:text-[#3E3438]'
            }`}
          >
            월간
          </button>
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
              viewMode === 'week'
                ? 'bg-white text-[#3E3438] shadow-2xs font-semibold'
                : 'text-[#85777D] hover:text-[#3E3438]'
            }`}
          >
            주간
          </button>
        </div>
      </div>

      {/* Main Container: Unified Calendar Surface */}
      <div className="bg-white rounded-2xl border border-[#F0E7EB] shadow-2xs overflow-hidden">
        {/* Weekday Row */}
        <div className="grid grid-cols-7 border-b border-[#F0E7EB] text-center text-xs font-medium text-[#85777D] py-2 bg-white">
          {weekdayLabels.map((day, idx) => {
            const isSun = startDayOffset === 0 ? idx === 0 : idx === 6;
            const isSat = startDayOffset === 0 ? idx === 6 : idx === 5;
            return (
              <div
                key={day}
                className={`py-0.5 ${
                  isSun ? 'text-[#CF8FA8] font-semibold' : isSat ? 'text-[#85777D]' : 'text-[#3E3438]'
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Unified Calendar Grid (Natural Grid without heavy per-day card borders) */}
        {viewMode === 'month' ? (
          <div className="grid grid-cols-7 divide-x divide-y divide-[#F0E7EB]">
            {monthDays.map((cell) => {
              const isSelected = cell.dateStr === selectedDate;
              const isDragTarget = dragOverDate === cell.dateStr;
              const daySchedules = schedulesByDate.get(cell.dateStr) || [];
              const isMenuOpen = activeDateMenu === cell.dateStr;

              return (
                <div
                  key={cell.dateStr}
                  data-calendar-date={cell.dateStr} role="button" tabIndex={0} aria-label={cell.dateStr + ' 일정 보기'}
                  onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelectDate(cell.dateStr); onOpenDay(cell.dateStr); } }}
                  onClick={() => {
                    onSelectDate(cell.dateStr); onOpenDay(cell.dateStr);
                    setActiveDateMenu(null);
                  }}
                  onDragOver={(e) => handleDragOver(e, cell.dateStr)}
                  onDragLeave={(e) => handleDragLeave(e, cell.dateStr)}
                  onDrop={(e) => handleDrop(e, cell.dateStr)}
                  className={`min-w-0 min-h-[100px] sm:min-h-[88px] p-0.5 sm:p-1.5 transition-colors cursor-pointer flex flex-col justify-between relative group ${
                    isSelected
                      ? 'bg-[#F4DCE5]/40'
                      : isDragTarget
                      ? 'bg-[#F6E8ED]'
                      : cell.isCurrentMonth
                      ? 'bg-white hover:bg-[#FFFAFB]'
                      : 'bg-[#FFFAFB]/50'
                  }`}
                >
                  {/* Date Number Header */}
                  <div className="flex items-center justify-between leading-none mb-1">
                    <span
                      className={`inline-flex items-center justify-center text-xs font-semibold rounded-full w-6 h-6 transition-all ${
                        cell.isToday
                          ? 'bg-[#CF8FA8] text-white shadow-2xs'
                          : isSelected
                          ? 'bg-[#CF8FA8]/20 text-[#3E3438] font-bold'
                          : cell.isCurrentMonth
                          ? 'text-[#3E3438]'
                          : 'text-[#85777D]/60'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {/* Subtle Menu Icon on hover/selected */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dateMenuAnchor.current=e.currentTarget;
                          setActiveDateMenu(isMenuOpen ? null : cell.dateStr);
                        }}
                        className={`hidden sm:block p-1 text-[#85777D] hover:text-[#3E3438] rounded transition-opacity ${
                          isSelected || isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        title="날짜 작업"
                      >
                        <MoreVertical className="w-3 h-3" />
                      </button>

                      {isMenuOpen && (
                        <CalendarDateMenu anchor={dateMenuAnchor.current} onClose={()=>setActiveDateMenu(null)}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDateMenu(null);
                              onOpenNewScheduleModal(cell.dateStr);
                            }}
                            className="w-full min-h-11 px-3 py-2 text-left text-[#3E3438] hover:bg-[#F6E8ED] flex items-center gap-1.5 cursor-pointer font-medium"
                          >
                            <Plus className="w-3 h-3 text-[#CF8FA8]" />
                            <span>일정 추가</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDateMenu(null);
                              onOpenDateCopyModal(cell.dateStr);
                            }}
                            className="w-full min-h-11 px-3 py-2 text-left text-[#3E3438] hover:bg-[#F6E8ED] flex items-center gap-1.5 cursor-pointer font-medium"
                          >
                            <Copy className="w-3 h-3 text-[#CF8FA8]" />
                            <span>일정 전체 복사</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDateMenu(null);
                              onOpenBatchDateModal(cell.dateStr);
                            }}
                            className="w-full min-h-11 px-3 py-2 text-left text-[#3E3438] hover:bg-[#F6E8ED] flex items-center gap-1.5 cursor-pointer font-medium"
                          >
                            <CalendarRange className="w-3 h-3 text-[#CF8FA8]" />
                            <span>여러 날짜 등록</span>
                          </button>
                        </CalendarDateMenu>
                      )}
                    </div>
                  </div>

                  {/* Schedule title previews on mobile and desktop */}
                  <div className="flex-1 overflow-hidden">
                    {/* Mobile: readable title previews; tapping opens the day sheet. */}
                    <div data-mobile-calendar-titles className="sm:hidden space-y-1 mt-0.5 min-w-0">
                      {daySchedules.slice(0,2).map(schedule=>{
                        const color=categoryMap.get(schedule.category)?.color || '#CF8FA8';
                        return <div key={schedule.id} data-calendar-title title={schedule.title} aria-label={schedule.title} className={'overflow-hidden whitespace-nowrap rounded-md px-0.5 py-0.5 text-[10px] leading-[18px] '+(schedule.completed?'line-through text-[#85777D]':schedule.isImportant?'font-bold text-[#3E3438]':'text-[#3E3438]')} style={{borderLeft:'3px solid '+color,backgroundColor:color+'35'}}>{schedule.isImportant&&<span aria-label="중요 일정" className="mr-0.5">★</span>}{Array.from(schedule.title).slice(0,schedule.isImportant?2:3).join('')}</div>;
                      })}
                      {daySchedules.length>2&&<p className="text-[9px] leading-3 text-[#85777D] text-right">+{daySchedules.length-2}개</p>}
                    </div>

                    {/* Desktop: Concise schedule bars */}
                    <div className="hidden sm:block space-y-1 mt-0.5">
                      {daySchedules.slice(0, 2).map((s) => {
                        const cat = categoryMap.get(s.category);
                        return (
                          <div
                            key={s.id}
                            draggable="true"
                            onDragStart={(e) => handleDragStart(e, s.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSchedule(s);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[11px] truncate leading-tight flex items-center gap-1 transition-all ${
                              s.completed
                                ? 'line-through text-[#85777D]/70 bg-stone-100'
                                : 'text-[#3E3438] hover:shadow-2xs'
                            }`}
                            style={{
                              backgroundColor: s.completed ? undefined : `${cat?.color || '#CF8FA8'}18`,
                              borderLeft: `3px solid ${cat?.color || '#CF8FA8'}`,
                            }}
                            title={`${s.startTime ? `[${s.startTime}] ` : ''}${s.title}`}
                          >
                            {s.startTime && (
                              <span className="font-semibold shrink-0 text-[10px] text-[#85777D]">
                                {s.startTime}
                              </span>
                            )}
                            <span className={`truncate ${s.isImportant ? 'font-bold' : 'font-medium'}`}>{s.isImportant && <Star aria-label="중요 일정" className="inline w-2.5 h-2.5 mr-0.5 fill-current" />}{s.title}</span>
                          </div>
                        );
                      })}
                      {daySchedules.length > 2 && (
                        <div className="text-[10px] text-[#85777D] font-semibold text-right pr-0.5">
                          +{daySchedules.length - 2}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Week View: 7 columns */
          <div className="grid grid-cols-7 divide-x divide-[#F0E7EB] min-h-[260px]">
            {weekDays.map((cell) => {
              const isSelected = cell.dateStr === selectedDate;
              const isDragTarget = dragOverDate === cell.dateStr;
              const daySchedules = schedulesByDate.get(cell.dateStr) || [];

              return (
                <div
                  key={cell.dateStr}
                  data-calendar-date={cell.dateStr} role="button" tabIndex={0} aria-label={cell.dateStr + ' 일정 보기'}
                  onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelectDate(cell.dateStr); onOpenDay(cell.dateStr); } }}
                  onClick={() => { onSelectDate(cell.dateStr); onOpenDay(cell.dateStr); }}
                  onDragOver={(e) => handleDragOver(e, cell.dateStr)}
                  onDragLeave={(e) => handleDragLeave(e, cell.dateStr)}
                  onDrop={(e) => handleDrop(e, cell.dateStr)}
                  className={`p-2 transition-colors cursor-pointer flex flex-col justify-start ${
                    isSelected
                      ? 'bg-[#F4DCE5]/40'
                      : isDragTarget
                      ? 'bg-[#F6E8ED]'
                      : 'bg-white hover:bg-[#FFFAFB]'
                  }`}
                >
                  <div className="text-center pb-2 border-b border-[#F0E7EB] mb-2">
                    <span className="text-[11px] font-semibold text-[#85777D] block">
                      {cell.dayName}
                    </span>
                    <span
                      className={`inline-flex items-center justify-center text-xs font-bold rounded-full w-6 h-6 mt-0.5 ${
                        cell.isToday
                          ? 'bg-[#CF8FA8] text-white shadow-2xs'
                          : isSelected
                          ? 'bg-[#CF8FA8]/20 text-[#3E3438]'
                          : 'text-[#3E3438]'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                  </div>

                  <div className="space-y-1 overflow-y-auto flex-1">
                    {daySchedules.map((s) => {
                      const cat = categoryMap.get(s.category);
                      return (
                        <div
                          key={s.id}
                          draggable="true"
                          onDragStart={(e) => handleDragStart(e, s.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditSchedule(s);
                          }}
                          className={`p-1.5 rounded-lg text-xs transition-all border ${
                            s.completed
                              ? 'bg-stone-50 border-stone-200 text-[#85777D]/70 line-through'
                              : 'bg-white border-[#F0E7EB] text-[#3E3438] hover:border-[#CF8FA8]'
                          }`}
                        >
                          {s.startTime && (
                            <span className="text-[10px] font-semibold text-[#CF8FA8] block mb-0.5">
                              {s.startTime}
                            </span>
                          )}
                          <p className={s.isImportant ? 'font-bold truncate' : 'font-medium truncate'}>{s.isImportant && '★ '}{s.title}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop agenda; mobile dates open the day sheet. */}
      <div className="hidden sm:block bg-white rounded-2xl border border-[#F0E7EB] shadow-2xs overflow-hidden">
        {/* List Header */}
        <div className="px-4 py-3 border-b border-[#F0E7EB] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-[#3E3438]">
              {formatKoreanDate(selectedDate)}
            </h3>
            <span className="text-xs font-semibold text-[#CF8FA8]">
              {selectedDateSchedules.length}개
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onOpenDateCopyModal(selectedDate)}
              className="p-1.5 text-[#85777D] hover:text-[#3E3438] hover:bg-[#F6E8ED] rounded-lg transition-colors cursor-pointer"
              title="이 날짜 일정 전체 복사"
            >
              <Copy className="w-4 h-4" />
            </button>

          </div>
        </div>

        {/* List of Schedules (Cardless rows with hairline dividers) */}
        <div className="divide-y divide-[#F0E7EB]">
          {selectedDateSchedules.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#85777D]">
              등록된 일정이 없습니다.
            </div>
          ) : (
            selectedDateSchedules.map((schedule) => {
              const cat = categoryMap.get(schedule.category);
              return (
                <div
                  key={schedule.id}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, schedule.id)}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#FFFAFB] transition-colors group"
                >
                  {/* Left: Completion Checkbox (Min 44px touch target) */}
                  <button
                    type="button"
                    onClick={() => onToggleSchedule(schedule.id)}
                    aria-label={schedule.completed ? '일정 완료 해제' : '일정 완료'}
                    aria-pressed={schedule.completed}
                    className="w-11 h-11 -ml-1 flex items-center justify-center text-stone-300 hover:text-[#CF8FA8] transition-colors cursor-pointer shrink-0"
                  >
                    {schedule.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-[#CF8FA8] fill-[#F4DCE5]" />
                    ) : (
                      <Circle className="w-5 h-5 text-[#85777D]/40 hover:text-[#CF8FA8]" />
                    )}
                  </button>

                  {/* Center: Schedule Content */}
                  <div
                    onClick={() => onEditSchedule(schedule)}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm ${schedule.isImportant ? 'font-bold' : 'font-medium'} whitespace-normal break-words ${
                          schedule.completed ? 'line-through text-[#85777D]' : 'text-[#3E3438]'
                        }`}
                      >
                        {schedule.isImportant && <Star aria-label="중요 일정" className="inline w-3.5 h-3.5 mr-1 fill-current text-[#AD728B]" />}{schedule.title}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-[#85777D]">
                      {schedule.startTime ? (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-[#CF8FA8]" />
                          {schedule.startTime}
                          {schedule.endTime ? ` ~ ${schedule.endTime}` : ''}
                        </span>
                      ) : (
                        <span>종일</span>
                      )}

                      <span
                        className="px-1.5 py-0.2 rounded text-[10px] font-medium"
                        style={{
                          backgroundColor: `${cat?.color || '#CF8FA8'}18`,
                          color: cat?.color || '#CF8FA8',
                        }}
                      >
                        {cat?.name || schedule.category || '미분류'}
                      </span>

                      {schedule.memo && (
                        <span className="truncate max-w-[140px] hidden sm:inline text-[#85777D]/80">
                          · {schedule.memo}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="calendar-actions flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenMoveModal(schedule)}
                      className="p-1.5 text-[#85777D] hover:text-[#CF8FA8] hover:bg-[#F6E8ED] rounded-lg transition-colors cursor-pointer"
                      title="이동/복사"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditSchedule(schedule)}
                      className="p-1.5 text-[#85777D] hover:text-[#3E3438] hover:bg-[#F6E8ED] rounded-lg transition-colors cursor-pointer"
                      title="수정"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSchedule(schedule.id)}
                      className="p-1.5 text-[#85777D] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
