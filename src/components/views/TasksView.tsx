import { DatePicker } from '../common/DatePicker';
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
  Settings2,
} from 'lucide-react';
import { getTodayDateString, formatKoreanDate } from '../../utils/dateHelpers';

interface TasksViewProps {
  tasks: Task[];
  presets: Preset[];
  presetGroups: PresetGroup[];
  onUsePreset: (id: string) => Promise<void> | void;
  onOpenPresetManager: () => void;
  onToggleTaskStatus: (taskId: string) => Promise<void> | void;
  onToggleTaskChecklist: (taskId: string, checklistId: string) => Promise<void> | void;
  onDeleteTask: (taskId: string) => Promise<void> | void;
  onQuickAddTask: (title: string, dueDate: string, projectId?: string, priority?: TaskPriority) => Promise<void> | void;
  onBatchDeleteTasks?: (taskIds: string[]) => Promise<void> | void;
  onBatchToggleTasks?: (taskIds: string[], targetDone: boolean) => Promise<void> | void;
}

type DateScopeFilter = 'today' | 'upcoming' | 'all';
type CompletionFilter = 'pending' | 'completed' | 'all';

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  presets, presetGroups, onUsePreset, onOpenPresetManager,
  onToggleTaskStatus,
  onToggleTaskChecklist,
  onDeleteTask,
  onQuickAddTask,
  onBatchDeleteTasks,
  onBatchToggleTasks,
}) => {
  const todayStr = getTodayDateString();
  const [dateScope, setDateScope] = useState<DateScopeFilter>('today');
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('pending');
  const [quickTitle, setQuickTitle] = useState('');
  const [blocks,setBlocks] = useState<TitleBlock[]>([]);
  const [titleHistory,setTitleHistory] = useState<{text:string;blocks:TitleBlock[]}[]>([]);
  const [presetsOpen,setPresetsOpen] = useState(false);
  const [applyMode,setApplyMode] = useState<'append'|'replace'>('append');
  const presetPanel = useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!presetsOpen)return;quickInput.current?.blur();const frame=requestAnimationFrame(()=>presetPanel.current?.scrollIntoView({block:'nearest'}));return()=>cancelAnimationFrame(frame);},[presetsOpen]);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const busy = useRef(false), quickInput = useRef<HTMLInputElement>(null), composing = useRef(false);
  const run = async (action: () => Promise<void>) => { if (busy.current) return; busy.current = true; setPending(true); setError(''); try { await action(); } catch { setError('변경사항을 저장하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.'); } finally { busy.current = false; setPending(false); } };
  const [quickDueDate, setQuickDueDate] = useState(() => {const day=new Date();day.setDate(day.getDate()+1);return day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');});

  // Selection mode for batch operations
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [expandedChecklists, setExpandedChecklists] = useState<Record<string, boolean>>({});

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // Completion
        if (completionFilter === 'pending' && t.status === 'done') return false;
        if (completionFilter === 'completed' && t.status !== 'done') return false;

        // Date Scope
        const dueDate = t.dueDate || todayStr;
        if (dateScope === 'today' && dueDate !== todayStr) return false;
        if (dateScope === 'upcoming' && dueDate <= todayStr) return false;

        return true;
      })
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  }, [tasks, dateScope, completionFilter, todayStr]);

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
    if(dateScope==='upcoming'&&(!quickDueDate || quickDueDate<=todayStr)){setError('예정된 할 일은 내일 이후 날짜를 선택하세요.');return;}
    if(dateScope==='all'&&!quickDueDate){setError('할 일을 등록할 날짜를 선택하세요.');return;}
    if(blocks.some(b=>!b.text.trim())){setError('빈 제목 블록을 입력하거나 제거해 주세요.');return;}
    await run(async () => { await onQuickAddTask(quickTitle.trim(), dateScope==='today'?getTodayDateString():quickDueDate, undefined, 'medium'); setQuickTitle('');setBlocks([]);setTitleHistory([]);setCompletionFilter('pending');requestAnimationFrame(()=>quickInput.current?.focus()); });
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
    <fieldset disabled={pending} className="task-view max-w-4xl mx-auto space-y-4 min-w-0">
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {/* Top Filter & Scope Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        {/* Date Scope: 오늘 | 예정 | 전체 */}
        <div role="group" aria-label="할 일 보기" className="flex items-center p-0.5 bg-[#F6E8ED] rounded-xl border border-[#F0E7EB] text-xs">
          <button
            type="button"
            aria-pressed={dateScope==='today'}
            onClick={() => {setDateScope('today');setError('');}}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium ${
              dateScope === 'today'
                ? 'bg-white text-[#3E3438] shadow-2xs font-semibold'
                : 'text-[#85777D] hover:text-[#3E3438]'
            }`}
          >
            오늘
          </button>
          <button
            type="button"
            aria-pressed={dateScope==='upcoming'}
            onClick={() => {setDateScope('upcoming');setError('');}}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium ${
              dateScope === 'upcoming'
                ? 'bg-white text-[#3E3438] shadow-2xs font-semibold'
                : 'text-[#85777D] hover:text-[#3E3438]'
            }`}
          >
            예정
          </button>
          <button
            type="button"
            aria-pressed={dateScope==='all'}
            onClick={() => {setDateScope('all');setError('');}}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium ${
              dateScope === 'all'
                ? 'bg-white text-[#3E3438] shadow-2xs font-semibold'
                : 'text-[#85777D] hover:text-[#3E3438]'
            }`}
          >
            전체
          </button>
        </div>

        {/* Completion & Select Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 bg-[#F6E8ED] rounded-xl border border-[#F0E7EB] text-xs">
            <button
              type="button"
              onClick={() => setCompletionFilter('pending')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                completionFilter === 'pending'
                  ? 'bg-white text-[#3E3438] shadow-2xs font-semibold'
                  : 'text-[#85777D] hover:text-[#3E3438]'
              }`}
            >
              미완료
            </button>
            <button
              type="button"
              onClick={() => setCompletionFilter('completed')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                completionFilter === 'completed'
                  ? 'bg-white text-[#3E3438] shadow-2xs font-semibold'
                  : 'text-[#85777D] hover:text-[#3E3438]'
              }`}
            >
              완료
            </button>
            <button
              type="button"
              onClick={() => setCompletionFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                completionFilter === 'all'
                  ? 'bg-white text-[#3E3438] shadow-2xs font-semibold'
                  : 'text-[#85777D] hover:text-[#3E3438]'
              }`}
            >
              모두
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              setSelectedTaskIds([]);
            }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              isSelectMode
                ? 'bg-[#CF8FA8] text-white border-[#CF8FA8]'
                : 'bg-white text-[#85777D] border-[#F0E7EB] hover:text-[#3E3438]'
            }`}
          >
            {isSelectMode ? '선택 취소' : '선택'}
          </button>
        </div>
      </div>

      {/* Main List Container: Cardless List */}
      <div className="bg-white rounded-2xl border border-[#F0E7EB] shadow-2xs overflow-hidden">
        {/* Quick Inline Add Bar */}
        <form aria-label="할 일 등록" onSubmit={handleQuickAdd} onKeyDown={e=>{if(e.key==='Enter'&&e.target instanceof HTMLInputElement&&e.target!==quickInput.current)e.preventDefault();}} className="p-3 space-y-2 border-b border-[#F0E7EB] bg-[#FFFAFB]/50">
          <div className="flex flex-wrap items-center gap-2"><div className="flex-1 min-w-0">{dateScope!=='today' ? <DatePicker label="할 일 날짜" value={quickDueDate} onChange={setQuickDueDate}/> : <p className="text-xs text-[#85777D] px-1">오늘 · {formatKoreanDate(todayStr)}</p>}</div><button type="button" onClick={onOpenPresetManager} className="min-h-11 px-2 flex items-center gap-1 text-xs text-[#8F526C] rounded-lg hover:bg-[#F6E8ED]"><Settings2 aria-hidden="true" className="w-4 h-4"/>프리셋 설정</button></div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#F0E7EB] focus-within:border-[#CF8FA8] transition-colors">
            <input
              type="text"
              ref={quickInput}
              aria-label="새 할 일 제목"
              onCompositionStart={()=>{composing.current=true;}}
              onCompositionEnd={()=>{composing.current=false;}}
              onKeyDown={e=>{if(e.key==='Enter'&&(e.nativeEvent.isComposing || e.keyCode===229 || composing.current))e.preventDefault();}}
              value={quickTitle}
              onChange={(e) => {setQuickTitle(e.target.value);setBlocks([]);}}
              placeholder="+ 새로운 할 일 입력 후 Enter"
              className="flex-1 min-w-0 text-sm bg-transparent text-[#3E3438] placeholder:text-[#85777D]/70 focus:outline-none"
            />
            <button type="button" aria-expanded={presetsOpen} onClick={()=>setPresetsOpen(!presetsOpen)} className="min-h-11 px-2 text-xs text-[#8F526C] bg-[#F6E8ED] rounded-lg">프리셋</button>
            <button
              type="submit"
              disabled={!quickTitle.trim()}
              className="px-2.5 py-1 text-xs font-semibold text-white bg-[#CF8FA8] hover:bg-[#BD7F98] disabled:opacity-40 rounded-lg transition-all cursor-pointer"
            >
              추가
            </button>
          </div>
          {!!blocks.length && <TitleBlockEditor compact editable hideWordInput blocks={blocks} word="" onWordChange={()=>{}} onChange={next=>{setTitleHistory(history=>[...history,{text:quickTitle,blocks}]);setBlocks(next);setQuickTitle(next.map(b=>b.text).join(' '));}}/>}
          {!!titleHistory.length && <button type="button" className="min-h-11 px-2 text-xs text-[#8F526C]" onClick={()=>{const previous=titleHistory[titleHistory.length-1];setQuickTitle(previous.text);setBlocks(previous.blocks);setTitleHistory(history=>history.slice(0,-1));}}>이전 제목 복구</button>}
          {presetsOpen && <div ref={presetPanel}><InlinePresetPicker presets={presets} presetGroups={presetGroups} selectedBlocks={blocks} onManage={onOpenPresetManager} onClose={()=>{setPresetsOpen(false);requestAnimationFrame(()=>quickInput.current?.focus({preventScroll:true}));}} options={<label className="flex items-center gap-2">적용 방식<select aria-label="프리셋 적용 방식" value={applyMode} onChange={e=>setApplyMode(e.target.value as 'append'|'replace')} className="min-h-11 border rounded-lg px-2 bg-white"><option value="append">이어 붙이기</option><option value="replace">제목 교체</option></select></label>} onAdd={(parts,preset)=>{
            const current=blocks.map(b=>b.text).join(' ')===quickTitle?blocks:quickTitle.trim()?[{id:crypto.randomUUID(),text:quickTitle.trim()}]:[];
            const next=applyMode==='append'?[...current,...parts]:parts;
            setTitleHistory(history=>[...history,{text:quickTitle,blocks}]);setBlocks(next);setQuickTitle(next.map(b=>b.text).join(' '));setApplyMode('append');
            void Promise.resolve().then(()=>onUsePreset(preset.id)).catch(()=>setError('제목은 적용했지만 프리셋 사용 기록을 저장하지 못했습니다.'));
          }}/></div>}
        </form>

        {/* Batch Selection Action Bar */}
        {isSelectMode && (
          <div className="px-4 py-2 bg-[#F6E8ED] border-b border-[#F0E7EB] flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[#CF8FA8] font-bold cursor-pointer hover:underline"
              >
                {selectedTaskIds.length === filteredTasks.length ? '전체 해제' : '전체 선택'}
              </button>
              <span className="text-[#85777D]">
                ({selectedTaskIds.length}/{filteredTasks.length}개 선택됨)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleBatchToggleDone(true)}
                disabled={selectedTaskIds.length === 0}
                className="px-2.5 py-1 text-xs font-medium bg-white text-[#3E3438] rounded-lg border border-[#F0E7EB] disabled:opacity-40 cursor-pointer"
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
        <div className="divide-y divide-[#F0E7EB]">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#85777D]">
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
                  className={`px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                    isSelected
                      ? 'bg-[#F4DCE5]/30'
                      : 'hover:bg-[#FFFAFB]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Checkbox (or select checkbox if in select mode) */}
                    {isSelectMode ? (
                      <button
                        type="button"
                        onClick={() => toggleSelectTask(task.id)}
                        className="w-7 h-7 flex items-center justify-center text-[#CF8FA8] cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-[#CF8FA8]" />
                        ) : (
                          <Square className="w-5 h-5 text-[#85777D]/40" />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void run(async () => { await onToggleTaskStatus(task.id); })}
                        aria-label={isDone ? '할 일 완료 해제' : '할 일 완료'}
                        aria-pressed={isDone}
                        className="w-11 h-11 -ml-1 flex items-center justify-center text-stone-300 hover:text-[#CF8FA8] transition-colors cursor-pointer shrink-0"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-[#CF8FA8] fill-[#F4DCE5]" />
                        ) : (
                          <Circle className="w-5 h-5 text-[#85777D]/40 hover:text-[#CF8FA8]" />
                        )}
                      </button>
                    )}

                    {/* Task Title & Meta */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium whitespace-normal break-words ${
                          isDone ? 'line-through text-[#85777D]' : 'text-[#3E3438]'
                        }`}
                      >
                        {task.title}
                      </p>

                      <div className="flex items-center gap-2 mt-0.5 text-xs text-[#85777D]">
                        {task.dueDate && (
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 text-[#CF8FA8]" />
                            {task.dueDate}
                          </span>
                        )}

                        {hasChecklist && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(task.id)}
                            className="flex items-center gap-1 text-[#CF8FA8] hover:underline cursor-pointer"
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
                              className="flex items-center gap-2 text-xs cursor-pointer py-0.5 text-[#3E3438]"
                            >
                              <input
                                type="checkbox"
                                checked={item.done}
                                onChange={() => {}}
                                className="rounded text-[#CF8FA8] focus:ring-0"
                              />
                              <span className={item.done ? 'line-through text-[#85777D]' : ''}>
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
                    <button
                      type="button"
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1.5 text-[#85777D] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
