import React, { useState, useEffect } from 'react';
import { Project, ProjectStatus } from '../../types';
import { X, Trash2, Calendar, Palette } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
  onDelete?: (projectId: string) => void;
  initialProject?: Partial<Project> | null;
}

const COLOR_OPTIONS = [
  { label: '로즈 핑크', value: '#D98DAA' },
  { label: '뮤트 로즈', value: '#B8587C' },
  { label: '소프트 플럼', value: '#875982' },
  { label: '세이지 그린', value: '#789D8A' },
  { label: '웜 모카', value: '#A88D82' }
];

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialProject
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [color, setColor] = useState('#D98DAA');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (initialProject) {
      setName(initialProject.name || '');
      setDescription(initialProject.description || '');
      setStartDate(initialProject.startDate || new Date().toISOString().slice(0, 10));
      setDueDate(initialProject.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
      setStatus(initialProject.status || 'active');
      setColor(initialProject.color || '#D98DAA');
      setMemo(initialProject.memo || '');
    } else {
      setName('');
      setDescription('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setDueDate(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
      setStatus('active');
      setColor('#D98DAA');
      setMemo('');
    }
  }, [initialProject, isOpen]);

  if (!isOpen) return null;

  const isEdit = !!initialProject?.id;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const project: Project = {
      id: initialProject?.id || `proj-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      startDate,
      dueDate,
      status,
      progress: initialProject?.progress ?? 0,
      color,
      taskIds: initialProject?.taskIds ?? [],
      memo: memo.trim()
    };
    onSave(project);
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
            {isEdit ? '프로젝트 수정' : '새 프로젝트 만들기'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-[#F9EBEF] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              프로젝트 이름 <span className="text-[#D98DAA]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 미니어리 (Minially) 웹앱 출시"
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">설명</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="프로젝트 목표나 설명..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
            />
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">상태</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['planned', 'active', 'done'] as ProjectStatus[]).map((st) => (
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
                    {st === 'planned' ? '예정' : st === 'active' ? '진행 중' : '완료'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-[#D98DAA]" /> 포인트 색상
              </label>
              <div className="flex items-center gap-2 pt-0.5">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    style={{ backgroundColor: c.value }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      color === c.value ? 'scale-115 border-[#473B40]' : 'border-white'
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">메모</label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="참고 사항..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
            />
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
            <div>
              {isEdit && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('프로젝트와 연관된 작업도 삭제됩니다. 계속하시겠습니까?')) {
                      onDelete(initialProject!.id!);
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
                {isEdit ? '수정' : '생성'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
