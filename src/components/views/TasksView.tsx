import { TaskPlanningModal } from '../modals/TaskPlanningModal';
import { TaskDateFilter } from '../common/TaskDateFilter';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Task, TaskPriority, Preset, PresetGroup, TitleBlock } from '../../types';
import { InlinePresetPicker } from '../common/InlinePresetPicker';
import { TitleBlockEditor } from '../common/TitleBlockEditor';
import {
  CheckCircle2,
  Circle,
  Calendar,
  Trash2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Settings2, Check, RotateCcw, ListChecks, X, Plus,
} from 'lucide-react';
import { getTodayDateString, formatKoreanDate } from '../../utils/dateHelpers';

interface TasksViewProps {
  tasks: Task[];
  presets: Preset[];
  presetGroups: PresetGroup[];
  onUsePreset: (id: string) => Promise<void> | void;
  onOpenPresetManager: () => void;
  selectedDate: string;
  selectedEndDate: string;
  onSelectRange: (start: string, end: string) => void;
  onSelectDate: (date: string) => void;
  onOpenCalendar: () => void;
  onRescheduleTask: (id: string, date: string) => Promise<void>;
  onToggleTaskStatus: (taskId: string) => Promise<void> | void;
  onToggleTaskChecklist: (taskId: string, checklistId: string) => Promise<void> | void;
  onDeleteTask: (taskId: string) => Promise<void> | void;
  onQuickAddTask: (title: string, dueDate: string, projectId?: string, priority?: TaskPriority) => Promise<void> | void;
  onBatchDeleteTasks?: (taskIds: string[]) => Promise<void> | void;
  onBatchToggleTasks?: (taskIds: string[], targetDone: boolean) => Promise<void> | void;
}

type CompletionFilter = 'pending' | 'completed' | 'all';

export const TasksView: React.FC<TasksViewProps> = ({
  tasks, selectedDate, selectedEndDate, onSelectRange, onSelectDate,
  presets, presetGroups, onUsePreset, onOpenPresetManager, onOpenCalendar, onRescheduleTask,
  onToggleTaskStatus,
  onToggleTaskChecklist,
  onDeleteTask,
  onQuickAddTask,
  onBatchDeleteTasks,
  onBatchToggleTasks,
}) => {
  const [dateTarget, setDateTarget] = useState<Task | null>(null);
  const [importing, setImporting] = useState(false);
  const todayStr = getTodayDateString();
  const chooseDate = (date: string) => { onSelectDate(date); setSelectedTaskIds([]); setError(''); };
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all');
  const [quickTitle, setQuickTitle] = useState('');
  const [blocks,setBlocks] = useState<TitleBlock[]>([]);
  const [titleHistory,setTitleHistory] = useState<{text:string;blocks:TitleBlock[]}[]>([]);
  const [presetsOpen,setPresetsOpen] = useState(false);
  const [applyMode,setApplyMode] = useState<'append'|'replace'>('append');
  const presetPanel = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const busy = useRef(false), quickInput = useRef<HTMLInputElement>(null), composing = useRef(false);
  const run = async (action: () => Promise<void>) => { if (busy.current) return; busy.current = true; setPending(true); setError(''); try { await action(); } catch { setError('변경사항을 저장하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.'); } finally { busy.current = false; setPending(false); } };

  // Selection mode for batch operations
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [expandedChecklists, setExpandedChecklists] = useState<Record<string, boolean>>({});
  useEffect(()=>{setSelectedTaskIds([]);},[selectedDate,selectedEndDate,completionFilter]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // Completion
        if (completionFilter === 'pending' && t.status === 'done') return false;
        if (completionFilter === 'completed' && t.status !== 'done') return false;

        // Date Scope
        const dueDate = t.dueDate;
        if (!dueDate || dueDate < selectedDate || dueDate > selectedEndDate) return false;

        return true;
      })
      .sort((a, b) => Number(a.status==='done')-Number(b.status==='done') || (a.dueDate || '').localeCompare(b.dueDate || ''));
  }, [tasks, selectedDate, selectedEndDate, completionFilter]);

  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedTaskIds.length === filteredTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredTasks.map((t) => t.id));
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || composing.current) return;
    if(blocks.some(b=>!b.text.trim())){setError('빈 제목 블록을 입력하거나 제거해 주세요.');return;}
    await run(async () => { await onQuickAddTask(quickTitle.trim(), selectedDate, undefined, 'medium'); setQuickTitle('');setBlocks([]);setTitleHistory([]);setCompletionFilter('pending');requestAnimationFrame(()=>quickInput.current?.focus({preventScroll:true})); });
  };

  const toggleExpand = (taskId: string) => {
    setExpandedChecklists((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const handleBatchDelete = () => {
    if (!window.confirm('선택한 할 일을 삭제할까요? 삭제 후 실행 취소할 수 있습니다.')) return;
    void run(async () => {
    if (selectedTaskIds.length === 0) return;
    if (onBatchDeleteTasks) {
      await onBatchDeleteTasks(selectedTaskIds);
    } else {
      for (const id of selectedTaskIds) await onDeleteTask(id);
    }
    setSelectedTaskIds([]);
    setIsSelectMode(false);
    });
  };

  const handleBatchToggleDone = (targetDone: boolean) => {
    void run(async () => {
    if (selectedTaskIds.length === 0) return;
    if (onBatchToggleTasks) {
      await onBatchToggleTasks(selectedTaskIds, targetDone);
    } else {
      for (const id of selectedTaskIds) await onToggleTaskStatus(id);
    }
    setSelectedTaskIds([]);
    setIsSelectMode(false);
    });
  };

  return (
    <fieldset aria-busy={pending} className="task-view max-w-4xl mx-auto space-y-3 min-w-0">
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <TaskPlanningModal task={dateTarget} importing={importing} tasks={tasks} onClose={()=>{setDateTarget(null);setImporting(false);}} onSaveDate={async(id,date)=>{await onRescheduleTask(id,date);chooseDate(date||todayStr);if(importing)setCompletionFilter('pending');}} />
      {/* Top Filter & Scope Controls */}
      <div className="space-y-2 px-1">
        <TaskDateFilter start={selectedDate} end={selectedEndDate} onChange={onSelectRange}/>

        {/* Completion & Select Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={()=>setImporting(true)} className="min-h-9 shrink-0 rounded-lg border border-app-outline bg-white px-2.5 text-xs text-app-accent">미완료 가져오기</button>
          <button type="button" onClick={onOpenCalendar} aria-haspopup="dialog" aria-label="캘린더 일정 가져오기" title="캘린더 일정 가져오기" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-app-outline bg-white px-2.5 text-xs text-app-accent"><Calendar aria-hidden="true" className="h-4 w-4" /></button>
          <div role="group" aria-label="할 일 완료 필터" className="flex items-center p-0.5 bg-app-soft rounded-lg border border-app-line text-xs">
            {([['all','모두'],['pending','미완료'],['completed','완료']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={completionFilter===value} onClick={()=>setCompletionFilter(value)} className={'min-h-8 px-2.5 rounded-md '+(completionFilter===value?'bg-white font-semibold text-app-ink':'text-app-muted')}>{label}</button>)}
          </div>

          <button
            type="button"
            aria-label={isSelectMode?'선택 취소':'선택'} title={isSelectMode?'선택 취소':'선택'}
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              setSelectedTaskIds([]);
            }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              isSelectMode
                ? 'bg-app-accent text-white border-app-accent'
                : 'bg-white text-app-muted border-app-line hover:text-app-ink'
            }`}
          >
            {isSelectMode ? <X aria-hidden="true" className="h-4 w-4"/> : <ListChecks aria-hidden="true" className="h-4 w-4"/>}
          </button>
        </div>
      </div>

      {/* Main List Container: Cardless List */}
      <div className="bg-white rounded-2xl border border-app-line shadow-2xs overflow-hidden">
        {/* Quick Inline Add Bar */}
        <form aria-label="할 일 등록" onSubmit={handleQuickAdd} onKeyDown={e=>{if(e.key==='Enter'&&e.target instanceof HTMLInputElement&&e.target!==quickInput.current)e.preventDefault();}} className="p-3 space-y-2 border-b border-app-line bg-app-canvas/50">
          <div className="flex flex-wrap items-center gap-2"><div className="flex-1 min-w-0"><p className="text-xs text-app-muted px-1">{formatKoreanDate(selectedDate)} · 간편 등록</p></div><button type="button" onClick={onOpenPresetManager} aria-label="프리셋 설정" title="프리셋 설정" className="min-h-9 px-2 flex items-center gap-1 text-xs text-app-accent rounded-lg hover:bg-app-soft"><Settings2 aria-hidden="true" className="w-4 h-4"/></button></div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-app-line focus-within:border-app-accent transition-colors">
            <input
              type="text"
              ref={quickInput}
              readOnly={pending}
              aria-label="새 할 일 제목"
              onCompositionStart={()=>{composing.current=true;}}
              onCompositionEnd={()=>{composing.current=false;}}
              onKeyDown={e=>{if(e.key==='Enter'&&(e.nativeEvent.isComposing || e.keyCode===229 || composing.current))e.preventDefault();}}
              value={quickTitle}
              onChange={(e) => {setQuickTitle(e.target.value);setBlocks([]);}}
              placeholder="+ 새로운 할 일 입력 후 Enter"
              className="flex-1 min-w-0 text-base sm:text-sm bg-transparent text-app-ink placeholder:text-app-muted/70 focus:outline-none"
            />
            <button type="button" disabled={pending} aria-expanded={presetsOpen} onClick={()=>setPresetsOpen(!presetsOpen)} className="min-h-9 px-2 text-xs text-app-accent bg-app-soft rounded-lg">프리셋</button>
            <button
              type="submit"
              aria-label="추가" title="할 일 추가"
              disabled={pending || !quickTitle.trim()}
              className="px-2.5 py-1 text-xs font-semibold text-white bg-app-accent hover:bg-app-accent-hover disabled:opacity-40 rounded-lg transition-all cursor-pointer"
            >
              <Plus aria-hidden="true" className="h-4 w-4"/>
            </button>
          </div>
          {!!blocks.length && <TitleBlockEditor compact editable hideWordInput blocks={blocks} word="" onWordChange={()=>{}} onChange={next=>{setTitleHistory(history=>[...history,{text:quickTitle,blocks}]);setBlocks(next);setQuickTitle(next.map(b=>b.text).join(' '));}}/>}
          {!!titleHistory.length && <button type="button" className="min-h-9 px-2 text-xs text-app-accent" onClick={()=>{const previous=titleHistory[titleHistory.length-1];setQuickTitle(previous.text);setBlocks(previous.blocks);setTitleHistory(history=>history.slice(0,-1));}}>이전 제목 복구</button>}
          {presetsOpen && <div ref={presetPanel}><InlinePresetPicker presets={presets} presetGroups={presetGroups} selectedBlocks={blocks} onManage={onOpenPresetManager} onClose={()=>{setPresetsOpen(false);requestAnimationFrame(()=>quickInput.current?.focus({preventScroll:true}));}} options={<label className="flex items-center gap-2">적용 방식<select aria-label="프리셋 적용 방식" value={applyMode} onChange={e=>setApplyMode(e.target.value as 'append'|'replace')} className="min-h-9 border rounded-lg px-2 bg-white"><option value="append">이어 붙이기</option><option value="replace">제목 교체</option></select></label>} onAdd={(parts,preset)=>{
            const current=blocks.map(b=>b.text).join(' ')===quickTitle?blocks:quickTitle.trim()?[{id:crypto.randomUUID(),text:quickTitle.trim()}]:[];
            const next=applyMode==='append'?[...current,...parts]:parts;
            setTitleHistory(history=>[...history,{text:quickTitle,blocks}]);setBlocks(next);setQuickTitle(next.map(b=>b.text).join(' '));setApplyMode('append');
            void Promise.resolve().then(()=>onUsePreset(preset.id)).catch(()=>setError('제목은 적용했지만 프리셋 사용 기록을 저장하지 못했습니다.'));
          }}/></div>}
        </form>

        {/* Batch Selection Action Bar */}
        {isSelectMode && (
          <div className="px-4 py-2 bg-app-soft border-b border-app-line flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-app-accent font-bold cursor-pointer hover:underline"
              >
                {selectedTaskIds.length === filteredTasks.length ? '전체 해제' : '전체 선택'}
              </button>
              <span className="text-app-muted">
                ({selectedTaskIds.length}/{filteredTasks.length}개 선택됨)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleBatchToggleDone(true)}
                disabled={selectedTaskIds.length === 0}
                className="px-2.5 py-1 text-xs font-medium bg-white text-app-ink rounded-lg border border-app-line disabled:opacity-40 cursor-pointer"
              >
                완료 처리
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={selectedTaskIds.length === 0}
                className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-600 rounded-lg border border-red-200 disabled:opacity-40 cursor-pointer"
              >
                삭제
              </button>
            </div>
          </div>
        )}

        {/* Cardless List of Tasks */}
        <div className="divide-y divide-app-line">
          {filteredTasks.length === 0 ? (
            <div className="py-2 text-center text-xs text-app-muted">
              등록된 할 일이 없습니다.
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isDone = task.status === 'done';
              const isSelected = selectedTaskIds.includes(task.id);
              const isExpanded = !!expandedChecklists[task.id];
              const hasChecklist = task.checklist && task.checklist.length > 0;
              const completedCount = task.checklist ? task.checklist.filter((c) => c.done).length : 0;

              return (
                <div
                  key={task.id}
                  data-task-id={task.id}
                  className={`px-3 py-1.5 flex items-center justify-between gap-2 transition-colors ${isDone ? 'bg-app-soft/70 border-l-[3px] border-l-app-accent' : ''} ${
                    isSelected
                      ? 'bg-app-soft/30'
                      : 'hover:bg-app-canvas'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Checkbox (or select checkbox if in select mode) */}
                    {isSelectMode ? (
                      <button
                        type="button"
                        onClick={() => toggleSelectTask(task.id)}
                        className="w-7 h-7 flex items-center justify-center text-app-accent cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-app-accent" />
                        ) : (
                          <Square className="w-5 h-5 text-app-muted/40" />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void run(async () => { await onToggleTaskStatus(task.id); })}
                        aria-label={isDone ? '할 일 완료 해제' : '할 일 완료'}
                        aria-pressed={isDone}
                        className="w-9 h-9 -ml-1 flex items-center justify-center text-stone-300 hover:text-app-accent transition-colors cursor-pointer shrink-0"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-app-accent fill-app-soft" />
                        ) : (
                          <Circle className="w-5 h-5 text-app-muted/40 hover:text-app-accent" />
                        )}
                      </button>
                    )}

                    {/* Task Title & Meta */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium whitespace-normal break-words ${
                          isDone ? 'line-through text-app-muted' : 'text-app-ink'
                        }`}
                      >
                        {task.title}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-app-muted">
                        <button type="button" aria-label={task.title+' 날짜 변경'} onClick={()=>setDateTarget(task)} className="flex items-center gap-1 font-mono text-app-accent hover:underline"><Calendar className="w-3 h-3"/>{task.dueDate || '날짜 선택'}</button>
                        {isDone && <span className="inline-flex items-center gap-0.5 text-[11px] rounded bg-[#8F526C] px-1.5 py-0.5 font-semibold text-white"><Check aria-hidden="true" className="h-3 w-3"/>완료</span>}

                        {hasChecklist && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(task.id)}
                            className="flex items-center gap-1 text-app-accent hover:underline cursor-pointer"
                          >
                            <span>
                              체크리스트 {completedCount}/{task.checklist?.length}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Expandable Checklist */}
                      {isExpanded && hasChecklist && (
                        <div className="mt-2 space-y-1 pl-1">
                          {task.checklist?.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => void run(async () => { await onToggleTaskChecklist(task.id, item.id); })}
                              className="flex items-center gap-2 text-xs cursor-pointer py-0.5 text-app-ink"
                            >
                              <input
                                type="checkbox"
                                checked={item.done}
                                onChange={() => {}}
                                className="rounded text-app-accent focus:ring-0"
                              />
                              <span className={item.done ? 'line-through text-app-muted' : ''}>
                                {item.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Single Delete Action */}
                  {!isSelectMode && (
                    <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={()=>void run(async()=>{await onToggleTaskStatus(task.id);})} aria-label={task.title+(isDone?' 완료 취소':' 완료')} title={isDone?'완료 취소':'완료'} className="min-h-8 rounded-lg px-2 text-xs text-app-accent">{isDone?<RotateCcw aria-hidden="true" className="h-4 w-4"/>:<Check aria-hidden="true" className="h-4 w-4"/>}</button>
                    <button
                      type="button"
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1.5 text-app-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button></div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </fieldset>
  );
};
