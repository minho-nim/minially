import React, { useState, useEffect } from 'react';
import { Preset, ScheduleCategory, RecurrenceType } from '../../types';
import { X, Trash2, Plus, Clock } from 'lucide-react';

interface PresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preset: Preset) => void;
  onDelete?: (presetId: string) => void;
  initialPreset?: Partial<Preset> | null;
}

export const PresetModal: React.FC<PresetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialPreset
}) => {
  const [name, setName] = useState('');
  const [defaultTitle, setDefaultTitle] = useState('');
  const [defaultCategory, setDefaultCategory] = useState<ScheduleCategory>('work');
  const [defaultStartTime, setDefaultStartTime] = useState('09:30');
  const [defaultDuration, setDefaultDuration] = useState<number>(30);
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [checklistTemplates, setChecklistTemplates] = useState<string[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (initialPreset) {
      setName(initialPreset.name || '');
      setDefaultTitle(initialPreset.defaultTitle || initialPreset.name || '');
      setDefaultCategory(initialPreset.defaultCategory || 'work');
      setDefaultStartTime(initialPreset.defaultStartTime || '10:00');
      setDefaultDuration(initialPreset.defaultDuration || 60);
      setRecurrence(initialPreset.recurrence || 'none');
      setChecklistTemplates(initialPreset.checklistTemplates || []);
      setMemo(initialPreset.memo || '');
    } else {
      setName('');
      setDefaultTitle('');
      setDefaultCategory('work');
      setDefaultStartTime('10:00');
      setDefaultDuration(60);
      setRecurrence('none');
      setChecklistTemplates([]);
      setMemo('');
    }
  }, [initialPreset, isOpen]);

  if (!isOpen) return null;

  const isEdit = !!initialPreset?.id;

  const handleAddTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;
    setChecklistTemplates([...checklistTemplates, newChecklistText.trim()]);
    setNewChecklistText('');
  };

  const handleRemoveTemplate = (index: number) => {
    setChecklistTemplates(checklistTemplates.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const preset: Preset = {
      id: initialPreset?.id || `preset-${Date.now()}`,
      type: 'title',
      usageCount: initialPreset?.usageCount || 0,
      createdAt: initialPreset?.createdAt || Date.now(),
      updatedAt: Date.now(),
      text: defaultTitle.trim() || name.trim(),
      name: name.trim(),
      icon: '',
      color: '#CF8FA8',
      defaultTitle: defaultTitle.trim() || name.trim(),
      defaultCategory,
      defaultStartTime,
      defaultDuration: Number(defaultDuration) || 30,
      recurrence,
      checklistTemplates,
      memo: memo.trim(),
      isFavorite: true
    };

    onSave(preset);
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
            {isEdit ? '프리셋 수정' : '새 프리셋 만들기'}
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
              프리셋 이름 <span className="text-[#D98DAA]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!defaultTitle) setDefaultTitle(e.target.value);
              }}
              placeholder="예: 모닝 데일리 스탠드업"
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              기본 일정 제목
            </label>
            <input
              type="text"
              value={defaultTitle}
              onChange={(e) => setDefaultTitle(e.target.value)}
              placeholder="일정 등록 시 자동으로 채워질 제목"
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">기본 카테고리</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDefaultCategory('work')}
                className={`py-1.5 px-3 text-xs font-medium rounded-xl border transition-all ${
                  defaultCategory === 'work'
                    ? 'bg-[#F9EBEF] text-[#9E5170] border-[#ECD0DB] font-bold shadow-2xs'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                업무
              </button>
              <button
                type="button"
                onClick={() => setDefaultCategory('personal')}
                className={`py-1.5 px-3 text-xs font-medium rounded-xl border transition-all ${
                  defaultCategory === 'personal'
                    ? 'bg-[#F6EFF4] text-[#875982] border-[#E7D6E4] font-bold shadow-2xs'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                개인
              </button>
              <button
                type="button"
                onClick={() => setDefaultCategory('project')}
                className={`py-1.5 px-3 text-xs font-medium rounded-xl border transition-all ${
                  defaultCategory === 'project'
                    ? 'bg-[#FFF0F4] text-[#B8587C] border-[#F5D2DF] font-bold shadow-2xs'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                프로젝트
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#D98DAA]" /> 시작 시간
              </label>
              <input
                type="time"
                value={defaultStartTime}
                onChange={(e) => setDefaultStartTime(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-stone-200 text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                기본 소요 시간
              </label>
              <select
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
              >
                <option value={15}>15분</option>
                <option value={30}>30분</option>
                <option value={45}>45분</option>
                <option value={60}>1시간 (60분)</option>
                <option value={90}>1시간 30분</option>
                <option value={120}>2시간</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">반복 안내</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
              >
                <option value="none">반복 없음</option>
                <option value="daily">매일</option>
                <option value="weekdays">평일 (월~금)</option>
                <option value="weekly">매주</option>
                <option value="monthly">매월</option>
              </select>
            </div>
          </div>

          {/* Checklist templates */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              체크리스트 템플릿
            </label>
            <div className="space-y-1 mb-2">
              {checklistTemplates.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 p-1.5 bg-stone-50 rounded-lg text-xs text-[#473B40]">
                  <span>• {item}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTemplate(idx)}
                    className="text-stone-400 hover:text-stone-700 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
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
                    handleAddTemplate(e);
                  }
                }}
                placeholder="체크 항목 입력 후 Enter"
                className="flex-1 px-2.5 py-1 rounded-lg border border-stone-200 text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
              />
              <button
                type="button"
                onClick={handleAddTemplate}
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
              placeholder="프리셋 설명..."
              className="w-full px-2.5 py-1.5 rounded-xl border border-stone-200 text-xs text-[#473B40] focus:outline-none focus:ring-1 focus:ring-[#D98DAA]"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
            <div>
              {isEdit && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('이 프리셋을 삭제하시겠습니까?')) {
                      onDelete(initialPreset!.id!);
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
                {isEdit ? '저장' : '등록'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
