import { SwipePager } from '../common/SwipePager';
import { calendarPageDays, shiftCalendarPage } from '../../utils/calendarPages';
import { CalendarDateMenu } from '../common/CalendarDateMenu';
import { compareSchedules } from '../../utils/scheduleOrder';
import React, { useState, useMemo, useRef } from 'react';
import {
  Schedule,
  ScheduleCategory,
  CategoryItem,
  AppSettings,
} from '../../types';
import {
  formatShortDate,
  getTodayDateString,
} from '../../utils/dateHelpers';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  MoreVertical,
  CalendarRange,
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
  onOpenCategoryModal: () => void;
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
  onOpenCategoryModal,
}) => {
  const todayStr = getTodayDateString();
  const [viewMode, setViewMode] = useState<CalendarMode>(settings.defaultView || 'month');
  const [activeDateMenu, setActiveDateMenu] = useState<string | null>(null);
  const dateMenuAnchor = useRef<HTMLButtonElement|null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [pressedDate, setPressedDate] = useState<string | null>(null);
  const pressStart = useRef<{x:number;y:number}|null>(null);
  const datePressProps = (date: string, preview: boolean) => ({
    'data-date-pressed': !preview && pressedDate === date,
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      if (preview || (event.target as Element).closest('button')) return;
      pressStart.current = {x:event.clientX,y:event.clientY}; setPressedDate(date);
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => { if (pressStart.current && Math.hypot(event.clientX-pressStart.current.x,event.clientY-pressStart.current.y)>10) { setPressedDate(null); pressStart.current=null; } },
    onPointerUp: () => {setPressedDate(null);pressStart.current=null;},
    onPointerCancel: () => {setPressedDate(null);pressStart.current=null;},
  });

  const viewDate = new Date((selectedDate || todayStr) + 'T12:00:00');
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

  const handlePrev = () => { setActiveDateMenu(null); onSelectDate(shiftCalendarPage(selectedDate, viewMode, -1)); };
  const handleNext = () => { setActiveDateMenu(null); onSelectDate(shiftCalendarPage(selectedDate, viewMode, 1)); };

  const handleGoToday = () => {
    onSelectDate(todayStr);
  };

  const startDayOffset = settings.startDayOfWeek; // 0: Sun, 1: Mon

  const weekDays = useMemo(() => calendarPageDays(selectedDate, 'week', startDayOffset, todayStr), [selectedDate, startDayOffset, todayStr]);

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

  const renderPage = (pageDate: string, preview = false) => {
    const selectedDate = pageDate;
    const monthDays = calendarPageDays(pageDate, 'month', startDayOffset, todayStr);
    const weekDays = calendarPageDays(pageDate, 'week', startDayOffset, todayStr);
    return <>        {/* Weekday Row */}
        <div className="grid grid-cols-7 text-center text-xs font-medium text-app-muted py-2">
          {weekdayLabels.map((day, idx) => {
            const isSun = startDayOffset === 0 ? idx === 0 : idx === 6;
            const isSat = startDayOffset === 0 ? idx === 6 : idx === 5;
            return (
              <div
                key={day}
                className={`py-0.5 ${
                  isSun ? 'text-app-accent font-semibold' : isSat ? 'text-app-muted' : 'text-app-ink'
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Unified Calendar Grid (Natural Grid without heavy per-day card borders) */}
        {viewMode === 'month' ? (
          <div className="calendar-month-grid min-h-0 flex-1 grid grid-cols-7" style={{'--calendar-rows':monthDays.length/7} as React.CSSProperties}>
            {monthDays.map((cell) => {
              const isSelected = cell.dateStr === selectedDate;
              const isDragTarget = dragOverDate === cell.dateStr;
              const daySchedules = schedulesByDate.get(cell.dateStr) || [];
              const isMenuOpen = !preview && activeDateMenu === cell.dateStr;

              return (
                <div
                  key={cell.dateStr}
                  {...datePressProps(cell.dateStr, preview)} data-calendar-date={preview ? undefined : cell.dateStr} role="button" tabIndex={0} aria-label={cell.dateStr + ' 일정 보기'}
                  onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelectDate(cell.dateStr); onOpenDay(cell.dateStr); } }}
                  onClick={() => {
                    onSelectDate(cell.dateStr); onOpenDay(cell.dateStr);
                    setActiveDateMenu(null);
                  }}
                  onDragOver={(e) => handleDragOver(e, cell.dateStr)}
                  onDragLeave={(e) => handleDragLeave(e, cell.dateStr)}
                  onDrop={(e) => handleDrop(e, cell.dateStr)}
                  className={`calendar-date-cell calendar-day-cell min-h-0 min-w-0 overflow-hidden p-0.5 sm:p-1.5 transition-colors cursor-pointer flex flex-col justify-between relative group ${
                    isDragTarget ? 'bg-app-soft/60' : 'bg-transparent'
                  }`}
                >
                  {/* Date Number Header */}
                  <div className="flex items-center justify-between leading-none mb-1">
                    <span data-date-number
                      className={`inline-flex items-center justify-center text-xs font-semibold rounded-full w-6 h-6 transition-all ${
                        cell.isToday
                          ? 'bg-app-accent text-white shadow-2xs'
                          : isSelected
                          ? 'bg-app-accent/20 text-app-ink font-bold'
                          : cell.isCurrentMonth
                          ? 'text-app-ink'
                          : 'text-app-muted/60'
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
                        className={`hidden sm:block p-1 text-app-muted hover:text-app-ink rounded transition-opacity ${
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
                            className="w-full min-h-9 px-3 py-2 text-left text-app-ink hover:bg-app-soft flex items-center gap-1.5 cursor-pointer font-medium"
                          >
                            <Plus className="w-3 h-3 text-app-accent" />
                            <span>일정 추가</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDateMenu(null);
                              onOpenDateCopyModal(cell.dateStr);
                            }}
                            className="w-full min-h-9 px-3 py-2 text-left text-app-ink hover:bg-app-soft flex items-center gap-1.5 cursor-pointer font-medium"
                          >
                            <Copy className="w-3 h-3 text-app-accent" />
                            <span>일정 전체 복사</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDateMenu(null);
                              onOpenBatchDateModal(cell.dateStr);
                            }}
                            className="w-full min-h-9 px-3 py-2 text-left text-app-ink hover:bg-app-soft flex items-center gap-1.5 cursor-pointer font-medium"
                          >
                            <CalendarRange className="w-3 h-3 text-app-accent" />
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
                        const color=categoryMap.get(schedule.category)?.color || '#DCA78F';
                        return <div key={schedule.id} data-calendar-title title={schedule.title} aria-label={schedule.title} className={'overflow-hidden whitespace-nowrap rounded-md px-0.5 py-0.5 text-[10px] leading-[18px] '+(schedule.completed?'line-through text-app-muted':schedule.isImportant?'font-bold text-app-ink':'text-app-ink')} style={{borderLeft:'3px solid '+color,backgroundColor:color+'35'}}>{schedule.isImportant&&<span aria-label="중요 일정" className="mr-0.5">★</span>}{Array.from(schedule.title).slice(0,schedule.isImportant?2:3).join('')}</div>;
                      })}
                      {daySchedules.length>1&&<span className="calendar-compact-count hidden absolute top-2 right-1 text-[9px] text-app-muted">+{daySchedules.length-1}</span>}
                      {daySchedules.length>2&&<p className="calendar-extra-count text-[9px] leading-3 text-app-muted text-right">+{daySchedules.length-2}개</p>}
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
                                ? 'line-through text-app-muted/70 bg-stone-100'
                                : 'text-app-ink hover:shadow-2xs'
                            }`}
                            style={{
                              backgroundColor: s.completed ? undefined : `${cat?.color || '#DCA78F'}18`,
                              borderLeft: `3px solid ${cat?.color || '#DCA78F'}`,
                            }}
                            title={`${s.startTime ? `[${s.startTime}] ` : ''}${s.title}`}
                          >
                            {s.startTime && (
                              <span className="font-semibold shrink-0 text-[10px] text-app-muted">
                                {s.startTime}
                              </span>
                            )}
                            <span className={`truncate ${s.isImportant ? 'font-bold' : 'font-medium'}`}>{s.isImportant && <Star aria-label="중요 일정" className="inline w-2.5 h-2.5 mr-0.5 fill-current" />}{s.title}</span>
                          </div>
                        );
                      })}
                      {daySchedules.length > 2 && (
                        <div className="text-[10px] text-app-muted font-semibold text-right pr-0.5">
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
          <div className="grid min-h-0 flex-1 grid-cols-7 overflow-hidden">
            {weekDays.map((cell) => {
              const isSelected = cell.dateStr === selectedDate;
              const isDragTarget = dragOverDate === cell.dateStr;
              const daySchedules = schedulesByDate.get(cell.dateStr) || [];

              return (
                <div
                  key={cell.dateStr}
                  {...datePressProps(cell.dateStr, preview)} data-calendar-date={preview ? undefined : cell.dateStr} role="button" tabIndex={0} aria-label={cell.dateStr + ' 일정 보기'}
                  onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelectDate(cell.dateStr); onOpenDay(cell.dateStr); } }}
                  onClick={() => { onSelectDate(cell.dateStr); onOpenDay(cell.dateStr); }}
                  onDragOver={(e) => handleDragOver(e, cell.dateStr)}
                  onDragLeave={(e) => handleDragLeave(e, cell.dateStr)}
                  onDrop={(e) => handleDrop(e, cell.dateStr)}
                  className={`calendar-date-cell min-w-0 min-h-0 overflow-hidden p-1 sm:p-2 transition-colors cursor-pointer flex flex-col justify-start ${
                    isDragTarget ? 'bg-app-soft/60' : 'bg-transparent'
                  }`}
                >
                  <div className="text-center pb-2 mb-2">
                    <span className="text-[11px] font-semibold text-app-muted block">
                      {cell.dayName}
                    </span>
                    <span data-date-number
                      className={`inline-flex items-center justify-center text-xs font-bold rounded-full w-6 h-6 mt-0.5 ${
                        cell.isToday
                          ? 'bg-app-accent text-white shadow-2xs'
                          : isSelected
                          ? 'bg-app-accent/20 text-app-ink'
                          : 'text-app-ink'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                  </div>

                  <div className="space-y-1 overflow-hidden flex-1 min-h-0">
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
                          className={`p-1.5 rounded-lg text-xs transition-all border ${
                            s.completed
                              ? 'bg-stone-50 border-stone-200 text-app-muted/70 line-through'
                              : 'bg-white border-app-line text-app-ink hover:border-app-accent'
                          }`}
                        >
                          {s.startTime && (
                            <span className="text-[10px] font-semibold text-app-accent block mb-0.5">
                              {s.startTime}
                            </span>
                          )}
                          <p className={s.isImportant ? 'font-bold truncate' : 'font-medium truncate'}>{s.isImportant && '★ '}{s.title}</p>
                        </div>
                      );
                    })}
                    {daySchedules.length > 2 && <p className="text-[10px] text-app-muted text-right">+{daySchedules.length - 2}개</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
</>;
  };

  return (
    <div className="calendar-view max-w-4xl mx-auto flex h-full min-h-0 w-full flex-col gap-1.5 sm:gap-2">
      <div role="group" aria-label="일정 만들기" className="flex flex-wrap items-center justify-end gap-1.5">
        {/* View Mode Toggle */}
        <div className="mr-auto shrink-0 flex items-center p-0.5 bg-app-soft rounded-lg border border-app-line text-xs">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
              viewMode === 'month'
                ? 'bg-white text-app-ink shadow-2xs font-semibold'
                : 'text-app-muted hover:text-app-ink'
            }`}
          >
            월간
          </button>
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
              viewMode === 'week'
                ? 'bg-white text-app-ink shadow-2xs font-semibold'
                : 'text-app-muted hover:text-app-ink'
            }`}
          >
            주간
          </button>
        </div>
        <button type="button" onClick={() => onOpenPresetModal()} className="min-h-9 px-3 rounded-xl border border-app-outline bg-white text-sm text-app-accent">프리셋</button>
        <button type="button" onClick={onOpenCategoryModal} className="min-h-9 shrink-0 whitespace-nowrap px-3 rounded-xl border border-app-outline bg-white text-sm text-app-accent">카테고리</button>
        <button type="button" onClick={() => onOpenNewScheduleModal(selectedDate)} className="min-h-9 px-3 rounded-xl bg-app-accent text-white text-sm font-semibold">일정 등록</button>
      </div>
      {/* Month/Week Navigation & Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 sm:px-2 pt-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 text-app-muted hover:text-app-ink hover:bg-app-soft rounded-lg transition-colors cursor-pointer"
              title="이전"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-app-ink px-1 select-none min-w-[120px] text-center">
              {viewMode === 'month'
                ? `${year}년 ${month + 1}월`
                : `${formatShortDate(weekDays[0]?.dateStr || selectedDate)} ~ ${formatShortDate(weekDays[6]?.dateStr || selectedDate)}`}
            </h2>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 text-app-muted hover:text-app-ink hover:bg-app-soft rounded-lg transition-colors cursor-pointer"
              title="다음"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoToday}
            className="px-2.5 py-1 text-xs font-semibold text-app-accent bg-white border border-app-line hover:bg-app-soft rounded-lg transition-colors cursor-pointer"
          >
            오늘
          </button>
        </div>
      </div>

      {/* Main Container: Unified Calendar Surface */}
      <SwipePager gap={24} pageKey={viewMode + selectedDate} previous={renderPage(shiftCalendarPage(selectedDate, viewMode, -1), true)} next={renderPage(shiftCalendarPage(selectedDate, viewMode, 1), true)} onPrevious={handlePrev} onNext={handleNext} data-calendar-swipe className="calendar-surface flex min-h-0 flex-1 flex-col overflow-hidden">
        {renderPage(selectedDate)}
      </SwipePager>

    </div>
  );
};
