import { SwipePager } from '../common/SwipePager';
import { calendarPageDays, shiftCalendarPage } from '../../utils/calendarPages';
import { CalendarDateMenu } from '../common/CalendarDateMenu';
import { compareSchedules } from '../../utils/scheduleOrder';
import { holidaysOn, longWeekends } from '../../utils/koreanHolidays';
import { buildRuns, layoutWeek, type SpanSlot } from '../../utils/scheduleSpans';
import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Repeat,
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
  /** 달 이동 줄 오른쪽에 놓는 추가 단추(같이 보기 전환 등) */
  headerExtra?: React.ReactNode;
}

type CalendarMode = 'month' | 'week';


/** 이어진 일정 모양: 이어지는 쪽은 둥근 모서리를 없애고 칸 끝까지 늘린다 */
const spanShape = (slot: SpanSlot) => [
  slot.joinsPrev ? 'calendar-span-prev rounded-l-none' : 'rounded-l-[4px]',
  slot.joinsNext ? 'calendar-span-next rounded-r-none' : 'rounded-r-[4px]',
].join(' ');

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
  headerExtra,
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

  // 같은 일정이 며칠 이어지면 달력에서 한 줄로 이어 그린다
  const runOf = useMemo(() => buildRuns(visibleSchedules), [visibleSchedules]);
  // 휴대폰 폭(640px 미만)인지: 휴대폰용·PC용 일정 줄 중 하나만 그린다
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 639px)').matches);
  useEffect(() => { const m = matchMedia('(max-width: 639px)'); const on = () => setNarrow(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, []);

  // 달력 한 장의 이름(달 보기는 'YYYY-MM', 주 보기는 그 주 첫날): 넘긴 뒤 같은 장은 새로 만들지 않고 옮겨 쓴다
  const pageId = (d: string) => viewMode + (viewMode === 'month' ? d.slice(0, 7) : calendarPageDays(d, 'week', settings.startDayOfWeek, todayStr)[0].dateStr);
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
    const slotsByDate = new Map<string, (SpanSlot | null)[]>();
    for (let i = 0; i < monthDays.length; i += 7) {
      const days = monthDays.slice(i, i + 7).map(c => c.dateStr);
      layoutWeek(days, schedulesByDate, runOf).forEach((lanes, col) => slotsByDate.set(days[col], lanes));
    }
    const offRuns = longWeekends(monthDays[0].dateStr, monthDays[monthDays.length - 1].dateStr);
    // 이름 줄이 있는 주는 그 주의 모든 칸에 같은 높이를 비워 둔다(이어진 일정 막대 높이를 맞추려고)
    const hasLabel = (c: { dateStr: string; isCurrentMonth: boolean }) => holidaysOn(c.dateStr).length > 0 || (offRuns.get(c.dateStr)?.start === c.dateStr && c.isCurrentMonth);
    const labelWeeks = new Set<number>();
    monthDays.forEach((c, i) => { if (hasLabel(c)) labelWeeks.add(Math.floor(i / 7)); });
    return <>        {/* Weekday Row */}
        <div className="grid grid-cols-7 text-center text-xs font-medium text-app-muted py-2">
          {weekdayLabels.map((day, idx) => {
            const isSun = startDayOffset === 0 ? idx === 0 : idx === 6;
            const isSat = startDayOffset === 0 ? idx === 6 : idx === 5;
            return (
              <div
                key={day}
                className={`py-0.5 ${
                  isSun ? 'text-app-accent-ink font-semibold' : isSat ? 'text-app-muted' : 'text-app-ink'
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
            {monthDays.map((cell, cellIndex) => {
              const isSelected = cell.dateStr === selectedDate;
              const isDragTarget = dragOverDate === cell.dateStr;
              const daySchedules = schedulesByDate.get(cell.dateStr) || [];
              const isMenuOpen = !preview && activeDateMenu === cell.dateStr;
              const slots = (slotsByDate.get(cell.dateStr) || []).slice(0, 2);
              const hidden = daySchedules.length - slots.filter(Boolean).length;
              const holidays = holidaysOn(cell.dateStr);
              const offRun = offRuns.get(cell.dateStr);
              const weekday = new Date(cell.dateStr + 'T12:00:00').getDay();
              const isRedDay = holidays.length > 0 || weekday === 0;
              const isBlueDay = !isRedDay && weekday === 6; // 토요일은 파랑(사진처럼)

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
                  data-holiday={holidays.length ? holidays.map(h => h.name).join(', ') : undefined} data-long-weekend={offRun ? offRun.days : undefined}
                  className={`calendar-date-cell calendar-day-cell min-h-0 min-w-0 overflow-hidden p-0.5 sm:p-1.5 transition-colors cursor-pointer flex flex-col justify-between relative group ${
                    isDragTarget ? 'bg-app-soft/60' : offRun && cell.isCurrentMonth ? 'calendar-long-weekend' : 'bg-transparent'
                  }`}
                >
                  {/* Date Number Header */}
                  <div className="flex items-center justify-between leading-none mb-1">
                    <span data-date-number
                      className={`inline-flex items-center justify-center text-xs font-normal sm:font-semibold rounded-full w-6 h-6 transition-all ${
                        cell.isToday
                          ? 'bg-app-accent-ink text-white shadow-2xs'
                          : isSelected
                          ? 'bg-app-accent/20 text-app-ink font-bold'
                          : cell.isCurrentMonth
                          ? isRedDay ? 'text-[#D9534F]' : isBlueDay ? 'text-[#3D7BD9]' : 'text-app-ink'
                          : isRedDay ? 'text-[#D9534F]/50' : isBlueDay ? 'text-[#3D7BD9]/50' : 'text-app-muted/60'
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
                            <Plus className="w-3 h-3 text-app-accent-ink" />
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
                            <Copy className="w-3 h-3 text-app-accent-ink" />
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
                            <CalendarRange className="w-3 h-3 text-app-accent-ink" />
                            <span>여러 날짜 등록</span>
                          </button>
                        </CalendarDateMenu>
                      )}
                    </div>
                  </div>

                  {/* 공휴일·연휴 이름: 날짜 아래 줄에 */}
                  {(holidays.length > 0 || (offRun && offRun.start === cell.dateStr && cell.isCurrentMonth)) && (
                    <p data-holiday-name className={`block min-w-0 overflow-hidden whitespace-nowrap text-clip -mx-0.5 px-0 sm:mx-0 sm:px-0.5 -mt-0.5 mb-0.5 text-[min(10px,2.6vw)] sm:text-[11px] tracking-[-0.05em] sm:tracking-normal font-semibold leading-tight ${cell.isCurrentMonth ? 'text-[#D9534F]' : 'text-[#D9534F]/50'}`} title={[...holidays.map(h => h.name), offRun && offRun.start === cell.dateStr ? `${offRun.days}일 연휴` : ''].filter(Boolean).join(' · ')}>
                      {holidays.length ? holidays[0].name.replace(/\(.*\)$/, '') : <><span className="sm:hidden">연휴</span><span className="hidden sm:inline">{offRun!.days}일 연휴</span></>}
                    </p>
                  )}
                  {!(holidays.length > 0 || (offRun && offRun.start === cell.dateStr && cell.isCurrentMonth)) && labelWeeks.has(Math.floor(cellIndex / 7)) && (
                    <p aria-hidden="true" className="block invisible -mt-0.5 mb-0.5 text-[10px] sm:text-[11px] leading-tight">·</p>
                  )}
                  {/* Schedule title previews on mobile and desktop */}
                  <div className="calendar-span-area flex-1">
                    {/* Mobile: readable title previews; tapping opens the day sheet. */}
                    {narrow && <div data-mobile-calendar-titles className="sm:hidden space-y-1 mt-0.5 min-w-0">
                      {slots.map((slot,lane)=>{
                        if(!slot)return <div key={'empty'+lane} data-calendar-lane-empty aria-hidden="true" className="h-[18px]"/>;
                        const schedule=slot.schedule;
                        const color=categoryMap.get(schedule.category)?.color || '#DCA78F';
                        const label=slot.showTitle?schedule.title:''; // 글자 수로 자르지 않고 칸 너비만큼 보인다(좁은 폰에서 5글자 안팎)
                        return <div key={schedule.id} data-calendar-title data-span={slot.length>1?slot.length:undefined} title={schedule.title} aria-label={schedule.title} className={'calendar-chip overflow-hidden whitespace-nowrap text-clip px-[3px] py-0.5 text-[10px] tracking-[-0.04em] leading-[18px] '+spanShape(slot)+' '+(schedule.completed?'line-through text-app-muted':schedule.isImportant?'font-bold':'font-normal')} style={{borderLeft:slot.joinsPrev?undefined:'3px solid '+color,backgroundColor:color+'2E',color:schedule.completed?undefined:`color-mix(in srgb, ${color} 45%, #4A3A40)`}}>{slot.showTitle&&schedule.isImportant&&<span aria-label="중요 일정" className="mr-0.5">★</span>}{slot.showTitle&&schedule.recurrenceRuleId&&<Repeat aria-label="반복 일정" className="inline w-2 h-2 mr-px -mt-px opacity-70"/>}{preview?<span className="cal-pv" data-label={label||'\u00a0'}/>:(label||'\u00a0')}</div>;
                      })}
                      {daySchedules.length>1&&<span className="calendar-compact-count hidden absolute top-2 right-1 text-[9px] text-app-muted">+{daySchedules.length-1}</span>}
                      {hidden>0&&<p className="calendar-extra-count text-[9px] leading-3 text-app-muted text-right">+{hidden}개</p>}
                    </div>}

                    {/* Desktop: Concise schedule bars(폭에 맞는 쪽만 그린다: 숨은 글자가 겹치지 않게) */}
                    {!narrow && <div className="hidden sm:block space-y-1 mt-0.5">
                      {slots.map((slot, lane) => {
                        if (!slot) return <div key={'empty' + lane} data-calendar-lane-empty aria-hidden="true" className="h-[22px]" />;
                        const s = slot.schedule;
                        const cat = categoryMap.get(s.category);
                        return (
                          <div
                            key={s.id}
                            data-span={slot.length > 1 ? slot.length : undefined}
                            draggable="true"
                            onDragStart={(e) => handleDragStart(e, s.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSchedule(s);
                            }}
                            className={`px-1.5 py-0.5 text-[11px] truncate leading-tight flex items-center gap-1 transition-all ${spanShape(slot)} ${
                              s.completed
                                ? 'line-through text-app-muted/70 bg-stone-100'
                                : 'text-app-ink hover:shadow-2xs'
                            }`}
                            style={{
                              backgroundColor: s.completed ? undefined : `${cat?.color || '#DCA78F'}${slot.length > 1 ? '30' : '18'}`,
                              borderLeft: slot.joinsPrev ? undefined : `3px solid ${cat?.color || '#DCA78F'}`,
                            }}
                            title={`${s.startTime ? `[${s.startTime}] ` : ''}${s.title}${slot.length > 1 ? ` (${slot.length}일)` : ''}`}
                          >
                            {slot.showTitle ? <>
                              {s.startTime && (
                                <span className="font-semibold shrink-0 text-[10px] text-app-muted">
                                  {s.startTime}
                                </span>
                              )}
                              <span className={`truncate ${s.isImportant ? 'font-bold' : 'font-medium'}`}>{s.isImportant && <Star aria-label="중요 일정" className="inline w-2.5 h-2.5 mr-0.5 fill-current" />}{s.recurrenceRuleId && <Repeat aria-label="반복 일정" className="inline w-2.5 h-2.5 mr-0.5 opacity-70" />}{preview ? <span className="cal-pv" data-label={s.title} /> : s.title}</span>
                            </> : <span aria-hidden="true">{'\u00a0'}</span>}
                          </div>
                        );
                      })}
                      {hidden > 0 && (
                        <div className="text-[10px] text-app-muted font-semibold text-right pr-0.5">
                          +{hidden}
                        </div>
                      )}
                    </div>}
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
                  <div className="shrink-0 text-center pb-2 mb-2">
                    <span className="text-[11px] font-semibold text-app-muted block">
                      {cell.dayName}
                    </span>
                    <span data-date-number
                      className={`inline-flex items-center justify-center text-xs font-bold rounded-full w-6 h-6 mt-0.5 ${
                        cell.isToday
                          ? 'bg-app-accent-ink text-white shadow-2xs'
                          : isSelected
                          ? 'bg-app-accent/20 text-app-ink'
                          : 'text-app-ink'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                  </div>

                  <div data-week-schedules={preview ? undefined : cell.dateStr} style={{touchAction: 'pan-y pinch-zoom'}} className="space-y-1 overflow-y-auto overscroll-contain flex-1 min-h-0">
                    {daySchedules.map((s) => {
                      const cat = categoryMap.get(s.category);
                      return (
                        <div
                          key={s.id}
                          data-week-schedule={preview ? undefined : s.id}
                          title={s.title}
                          draggable="true"
                          onDragStart={(e) => handleDragStart(e, s.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditSchedule(s);
                          }}
                          data-week-color={cat?.color || '#DCA78F'}
                          className={`p-1.5 rounded-lg text-xs transition-all ${
                            s.completed
                              ? 'bg-stone-50 text-app-muted/70 line-through'
                              : 'text-app-ink hover:shadow-2xs'
                          }`}
                          style={{ backgroundColor: s.completed ? undefined : `${cat?.color || '#DCA78F'}22`, borderLeft: `3px solid ${cat?.color || '#DCA78F'}` }}
                        >
                          {s.startTime && (
                            <span className="text-[10px] font-semibold block mb-0.5" style={{ color: cat?.color || undefined }}>
                              {s.startTime}
                            </span>
                          )}
                          <p className={s.isImportant ? 'font-bold truncate' : 'font-medium truncate'}>{s.isImportant && '★ '}{s.recurrenceRuleId && <Repeat aria-label="반복 일정" className="inline w-3 h-3 mr-0.5 -mt-0.5 opacity-70" />}{preview ? <span className="cal-pv" data-label={s.title} /> : s.title}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
</>;
  };

  return (
    <div className="calendar-view max-w-4xl mx-auto flex h-full min-h-0 w-full flex-col gap-1 sm:gap-1.5">
      <div role="group" aria-label="일정 만들기" className="flex flex-wrap items-center justify-end gap-1.5">
        {/* View Mode Toggle */}
        <div className="mr-auto shrink-0 flex items-center p-0.5 bg-app-soft rounded-lg border border-app-line text-xs">
          <button
            type="button"
            onClick={() => setViewMode('month')} data-shortcut="month"
            className={`min-h-11 md:min-h-0 px-3 md:px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
              viewMode === 'month'
                ? 'bg-white text-app-ink shadow-2xs font-semibold'
                : 'text-app-muted hover:text-app-ink'
            }`}
          >
            월간
          </button>
          <button
            type="button"
            onClick={() => setViewMode('week')} data-shortcut="week"
            className={`min-h-11 md:min-h-0 px-3 md:px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
              viewMode === 'week'
                ? 'bg-white text-app-ink shadow-2xs font-semibold'
                : 'text-app-muted hover:text-app-ink'
            }`}
          >
            주간
          </button>
        </div>
        <button type="button" onClick={() => onOpenPresetModal()} className="min-h-8 relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] md:after:hidden px-2.5 rounded-lg border border-app-outline bg-white text-xs text-app-accent-ink">프리셋</button>
        <button type="button" onClick={onOpenCategoryModal} className="min-h-8 relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] md:after:hidden shrink-0 whitespace-nowrap px-2.5 rounded-lg border border-app-outline bg-white text-xs text-app-accent-ink">카테고리</button>
        <button type="button" onClick={() => onOpenNewScheduleModal(selectedDate)} className="min-h-8 relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] md:after:hidden px-2.5 rounded-lg bg-app-accent-ink text-white text-xs font-semibold">일정 등록</button>
      </div>
      {/* Month/Week Navigation & Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 sm:px-2 pt-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <button
              type="button"
              onClick={handlePrev} data-shortcut="prev"
              className="p-2.5 md:p-1.5 text-app-muted hover:text-app-ink hover:bg-app-soft rounded-lg transition-colors cursor-pointer"
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
              onClick={handleNext} data-shortcut="next"
              className="p-2.5 md:p-1.5 text-app-muted hover:text-app-ink hover:bg-app-soft rounded-lg transition-colors cursor-pointer"
              title="다음"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoToday} data-shortcut="today"
            className="min-h-11 md:min-h-0 px-3 md:px-2.5 py-1 text-xs font-semibold text-app-accent-ink bg-white border border-app-line hover:bg-app-soft rounded-lg transition-colors cursor-pointer"
          >
            오늘
          </button>
        </div>
        {headerExtra}
      </div>

      {/* Main Container: Unified Calendar Surface */}
      <SwipePager preload gap={24} touchAction="pinch-zoom" pageKey={viewMode + selectedDate} previousKey={pageId(shiftCalendarPage(selectedDate, viewMode, -1))} currentKey={pageId(selectedDate)} nextKey={pageId(shiftCalendarPage(selectedDate, viewMode, 1))} previous={renderPage(shiftCalendarPage(selectedDate, viewMode, -1), true)} next={renderPage(shiftCalendarPage(selectedDate, viewMode, 1), true)} onPrevious={handlePrev} onNext={handleNext} data-calendar-swipe className="calendar-surface flex min-h-0 flex-1 flex-col overflow-hidden">
        {renderPage(selectedDate)}
      </SwipePager>

    </div>
  );
};
