import React, { useMemo } from 'react';
import { Task, Project } from '../../types';
import { getTodayDateString, DAYS_KR } from '../../utils/dateHelpers';
import { Clock, CheckCircle2, Circle } from 'lucide-react';

interface GanttChartProps {
  project: Project;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

export const GanttChart: React.FC<GanttChartProps> = ({ project, tasks, onSelectTask }) => {
  const todayStr = getTodayDateString();

  const { startDate, totalDays, datesList } = useMemo(() => {
    let minDate = project.startDate || todayStr;
    let maxDate = project.dueDate || todayStr;

    tasks.forEach((t) => {
      if (t.startDate && t.startDate < minDate) minDate = t.startDate;
      if (t.dueDate && t.dueDate > maxDate) maxDate = t.dueDate;
    });

    const start = new Date(minDate);
    const end = new Date(maxDate);

    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() + 2);

    const diffTime = end.getTime() - start.getTime();
    const count = Math.max(7, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const list: { dateStr: string; dayNum: number; dayName: string; isToday: boolean; isWeekend: boolean }[] = [];
    const curr = new Date(start);

    for (let i = 0; i < count; i++) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dayOfWeek = curr.getDay();

      list.push({
        dateStr,
        dayNum: curr.getDate(),
        dayName: DAYS_KR[dayOfWeek],
        isToday: dateStr === todayStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6
      });

      curr.setDate(curr.getDate() + 1);
    }

    return {
      startDate: start,
      totalDays: count,
      datesList: list
    };
  }, [project, tasks, todayStr]);

  const getTaskPosition = (task: Task) => {
    const startStr = task.startDate || task.dueDate || project.startDate || todayStr;
    const dueStr = task.dueDate || startStr;
    const tStart = new Date(startStr);
    const tEnd = new Date(dueStr);

    const offsetDays = Math.max(0, Math.floor((tStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const durationDays = Math.max(1, Math.ceil((tEnd.getTime() - tStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const leftPercent = (offsetDays / totalDays) * 100;
    const widthPercent = Math.min(100 - leftPercent, (durationDays / totalDays) * 100);

    return {
      left: `${leftPercent}%`,
      width: `${Math.max(2, widthPercent)}%`
    };
  };

  const todayIndex = datesList.findIndex((d) => d.isToday);
  const todayLeftPercent = todayIndex >= 0 ? (todayIndex / totalDays) * 100 + (0.5 / totalDays) * 100 : null;

  return (
    <div className="bg-white rounded-2xl border border-[#F2E2E7] shadow-xs overflow-hidden">
      {/* Legend & Summary */}
      <div className="p-3 bg-[#FFF8FA] border-b border-[#F2E2E7] flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-[#473B40]">
          작업 타임라인 ({tasks.length}개)
        </span>

        <div className="flex items-center gap-3 text-stone-500 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>완료</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D98DAA]" />
            <span>진행 중</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-300" />
            <span>대기</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full border border-rose-500 bg-rose-200" />
            <span>오늘 기준선</span>
          </div>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="p-12 text-center text-stone-400 text-xs">
          등록된 세부 작업이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Column Headers */}
            <div className="grid grid-cols-[200px_1fr] border-b border-stone-200 bg-stone-50/80 text-xs font-semibold text-stone-600 sticky top-0 z-10">
              <div className="p-2.5 border-r border-stone-200">
                작업명
              </div>
              <div className="relative flex">
                {datesList.map((d) => (
                  <div
                    key={d.dateStr}
                    style={{ width: `${100 / totalDays}%` }}
                    className={`py-1.5 text-center border-r border-stone-100 flex flex-col items-center justify-center ${
                      d.isToday
                        ? 'bg-[#F9EBEF] text-[#9E5170] font-bold'
                        : d.isWeekend
                        ? 'bg-stone-100/50 text-stone-400'
                        : 'text-stone-600'
                    }`}
                  >
                    <span className="text-[10px] leading-tight">{d.dayName}</span>
                    <span className="text-xs font-mono">{d.dayNum}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gantt Rows */}
            <div className="relative divide-y divide-stone-100">
              {/* Today guideline */}
              {todayLeftPercent !== null && (
                <div
                  style={{ left: `calc(200px + (100% - 200px) * ${todayLeftPercent / 100})` }}
                  className="absolute top-0 bottom-0 w-[1.5px] bg-[#D98DAA] z-20 pointer-events-none"
                >
                  <div className="sticky top-10 -ml-2.5 bg-[#D98DAA] text-white text-[9px] px-1 py-0.2 rounded shadow-2xs whitespace-nowrap">
                    오늘
                  </div>
                </div>
              )}

              {tasks.map((task) => {
                const pos = getTaskPosition(task);
                const isDone = task.status === 'done';
                const isDoing = task.status === 'doing';

                let barColorClass = 'bg-stone-300 hover:bg-stone-400 text-stone-800';
                if (isDone) barColorClass = 'bg-emerald-500 hover:bg-emerald-600 text-white';
                if (isDoing) barColorClass = 'bg-[#D98DAA] hover:bg-[#C97996] text-white';

                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="grid grid-cols-[200px_1fr] hover:bg-stone-50 cursor-pointer transition-colors"
                  >
                    <div className="p-2.5 border-r border-stone-100 flex items-center gap-1.5 overflow-hidden">
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : isDoing ? (
                        <Clock className="w-3.5 h-3.5 text-[#D98DAA] shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                      )}
                      <span className={`text-xs truncate ${isDone ? 'line-through text-stone-400' : 'text-[#473B40]'}`}>
                        {task.title}
                      </span>
                    </div>

                    <div className="relative py-2 px-1 flex items-center">
                      <div className="absolute inset-0 flex pointer-events-none">
                        {datesList.map((d) => (
                          <div
                            key={d.dateStr}
                            style={{ width: `${100 / totalDays}%` }}
                            className={`border-r border-stone-100 h-full ${
                              d.isWeekend ? 'bg-stone-50/40' : ''
                            }`}
                          />
                        ))}
                      </div>

                      <div
                        style={{
                          left: pos.left,
                          width: pos.width
                        }}
                        className={`relative z-10 h-6 rounded-md px-2 flex items-center justify-between text-[11px] font-medium transition-all shadow-2xs ${barColorClass}`}
                        title={`${task.title} (${task.startDate || ''} ~ ${task.dueDate || ''})`}
                      >
                        <span className="truncate pr-1">{task.title}</span>
                        {task.dueDate && (
                          <span className="text-[10px] opacity-80 font-mono hidden sm:inline">
                            {task.dueDate.slice(5)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
