import React, { useState, useMemo } from 'react';
import { Task, TaskPriority } from '../../types';
import {
  CheckCircle2,
  Circle,
  Calendar,
  Trash2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getTodayDateString, formatKoreanDate } from '../../utils/dateHelpers';

interface TasksViewProps {
  tasks: Task[];
  onToggleTaskStatus: (taskId: string) => void;
  onToggleTaskChecklist: (taskId: string, checklistId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onQuickAddTask: (title: string, dueDate: string, projectId?: string, priority?: TaskPriority) => void;
  onBatchDeleteTasks?: (taskIds: string[]) => void;
  onBatchToggleTasks?: (taskIds: string[], targetDone: boolean) => void;
}

type DateScopeFilter = 'today' | 'upcoming' | 'all';
type CompletionFilter = 'pending' | 'completed' | 'all';

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
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
  const [quickDueDate, setQuickDueDate] = useState(todayStr);

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

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    onQuickAddTask(quickTitle.trim(), quickDueDate, undefined, 'medium');
    setQuickTitle('');
  };

  const toggleExpand = (taskId: string) => {
    setExpandedChecklists((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const handleBatchDelete = () => {
    if (selectedTaskIds.length === 0) return;
    if (onBatchDeleteTasks) {
      onBatchDeleteTasks(selectedTaskIds);
    } else {
      for (const id of selectedTaskIds) onDeleteTask(id);
    }
    setSelectedTaskIds([]);
    setIsSelectMode(false);
  };

  const handleBatchToggleDone = (targetDone: boolean) => {
    if (selectedTaskIds.length === 0) return;
    if (onBatchToggleTasks) {
      onBatchToggleTasks(selectedTaskIds, targetDone);
    } else {
      for (const id of selectedTaskIds) onToggleTaskStatus(id);
    }
    setSelectedTaskIds([]);
    setIsSelectMode(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Filter & Scope Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        {/* Date Scope: 오늘 | 예정 | 전체 */}
        <div className="flex items-center p-0.5 bg-[#F6E8ED] rounded-xl border border-[#F0E7EB] text-xs">
          <button
            type="button"
            onClick={() => setDateScope('today')}
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
            onClick={() => setDateScope('upcoming')}
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
            onClick={() => setDateScope('all')}
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
        <form onSubmit={handleQuickAdd} className="p-3 border-b border-[#F0E7EB] bg-[#FFFAFB]/50">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#F0E7EB] focus-within:border-[#CF8FA8] transition-colors">
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="+ 새로운 할 일 입력 후 Enter"
              className="flex-1 text-sm bg-transparent text-[#3E3438] placeholder:text-[#85777D]/70 focus:outline-none"
            />
            <input
              type="date"
              value={quickDueDate}
              onChange={(e) => setQuickDueDate(e.target.value)}
              className="text-xs text-[#85777D] bg-transparent focus:outline-none hidden sm:inline"
            />
            <button
              type="submit"
              disabled={!quickTitle.trim()}
              className="px-2.5 py-1 text-xs font-semibold text-white bg-[#CF8FA8] hover:bg-[#BD7F98] disabled:opacity-40 rounded-lg transition-all cursor-pointer"
            >
              추가
            </button>
          </div>
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
                        onClick={() => onToggleTaskStatus(task.id)}
                        className="w-8 h-8 -ml-1 flex items-center justify-center text-stone-300 hover:text-[#CF8FA8] transition-colors cursor-pointer shrink-0"
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
                        className={`text-sm font-medium truncate ${
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
                              onClick={() => onToggleTaskChecklist(task.id, item.id)}
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
    </div>
  );
};
