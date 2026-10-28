import React, { useState, useEffect } from 'react';
import { Task, TaskPriority, TaskStatus, ChecklistItem, Project } from '../../types';
import { X, Trash2, Plus, Calendar, CheckSquare } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  initialTask?: Partial<Task> | null;
  projectId?: string;
  projects: Project[];
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialTask,
  projectId,
  projects
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (initialTask) {
      setSelectedProjectId(initialTask.projectId || projectId || (projects[0]?.id ?? ''));
      setTitle(initialTask.title || '');
      setStartDate(initialTask.startDate || new Date().toISOString().slice(0, 10));
      setDueDate(initialTask.dueDate || new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
      setStatus(initialTask.status || 'todo');
      setPriority(initialTask.priority || 'medium');
      setChecklist(initialTask.checklist || []);
      setMemo(initialTask.memo || '');
    } else {
      setSelectedProjectId(projectId || (projects[0]?.id ?? ''));
      setTitle('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setDueDate(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
      setStatus('todo');
      setPriority('medium');
      setChecklist([]);
      setMemo('');
    }
  }, [initialTask, projectId, projects, isOpen]);

  if (!isOpen) return null;

  const isEdit = !!initialTask?.id;

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;
    setChecklist([
      ...checklist,
      {
        id: `chk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        text: newChecklistText.trim(),
        done: false
      }
    ]);
    setNewChecklistText('');
  };

  const handleRemoveChecklist = (id: string) => {
    setChecklist(checklist.filter((item) => item.id !== id));
  };

  const handleToggleChecklist = (id: string) => {
    setChecklist(
      checklist.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedProjectId) return;

    const task: Task = {
      id: initialTask?.id || `task-${Date.now()}`,
      projectId: selectedProjectId,
      title: title.trim(),
      startDate,
      dueDate,
      status,
      priority,
      dependencyTaskIds: initialTask?.dependencyTaskIds || [],
      checklist,
      memo: memo.trim()
    };
    onSave(task);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-xs">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#F2E2E7] overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="px-5 py-3.5 border-b border-[#F2E2E7] flex items-center justify-between bg-[#FFF8FA]">
          <h2 className="text-sm font-bold text-[#473B40]">
            {isEdit ? '작업 수정' : '새 작업 등록'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-[#F9EBEF] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Project selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">소속 프로젝트</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              작업명 <span className="text-[#D98DAA]">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 마일스톤 기획서 작성"
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#D98DAA]" /> 시작일
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-stone-200 text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#D98DAA]" /> 마감일
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-stone-200 text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
              />
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">진행 상태</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['todo', 'doing', 'done'] as TaskStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={`py-1.5 text-xs font-medium rounded-xl border transition-all ${
                      status === st
                        ? 'bg-[#F9EBEF] text-[#9E5170] border-[#ECD0DB] font-bold shadow-2xs'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {st === 'todo' ? '대기' : st === 'doing' ? '진행 중' : '완료'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">우선순위</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['low', 'medium', 'high'] as TaskPriority[]).map((pr) => (
                  <button
                    key={pr}
                    type="button"
                    onClick={() => setPriority(pr)}
                    className={`py-1.5 text-xs font-medium rounded-xl border transition-all ${
                      priority === pr
                        ? 'bg-[#F6EFF4] text-[#875982] border-[#E7D6E4] font-bold shadow-2xs'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {pr === 'low' ? '낮음' : pr === 'medium' ? '보통' : '높음'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1 flex items-center gap-1">
              <CheckSquare className="w-3.5 h-3.5 text-[#D98DAA]" /> 체크리스트
            </label>
            <div className="space-y-1 mb-2">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 p-1.5 bg-stone-50 rounded-lg text-xs">
                  <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleToggleChecklist(item.id)}
                      className="w-3.5 h-3.5 rounded-sm accent-[#D98DAA]"
                    />
                    <span className={item.done ? 'line-through text-stone-400' : 'text-[#473B40]'}>
                      {item.text}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemoveChecklist(item.id)}
                    className="text-stone-400 hover:text-stone-700 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklist(e);
                  }
                }}
                placeholder="체크 항목 추가 후 Enter"
                className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-stone-200 text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
              />
              <button
                type="button"
                onClick={handleAddChecklist}
                className="px-2.5 py-1 bg-[#F9EBEF] text-[#9E5170] text-xs font-semibold rounded-lg hover:bg-[#ECD0DB] transition"
              >
                추가
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">메모</label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="참고 사항..."
              className="w-full px-2.5 py-1.5 rounded-xl border border-stone-200 text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
            />
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
            <div>
              {isEdit && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('이 작업을 삭제하시겠습니까?')) {
                      onDelete(initialTask!.id!);
                      onClose();
                    }
                  }}
                  className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 삭제
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#D98DAA] hover:bg-[#C97996] rounded-lg shadow-xs transition"
              >
                {isEdit ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
