import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Schedule,
  ScheduleCategory,
  Preset,
  CategoryItem,
  RecurrenceFrequency,
  PhraseType,
} from '../../types';
import { addMinutesToTime } from '../../utils/storage';
import {
  X,
  Clock,
  Calendar,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Star,
  Plus,
} from 'lucide-react';
import { PhraseManageModal } from './PhraseManageModal';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: Schedule, keepOpen?: boolean) => Promise<void> | void;
  onDelete?: (scheduleId: string) => void;
  onSaveAsPreset?: (presetData: Partial<Preset>) => void;
  onUsePreset: (presetId: string) => Promise<void> | void;
  onSavePreset: (preset: Preset) => Promise<void> | void;
  onDeletePreset: (presetId: string) => Promise<void> | void;
  onReorderPresets: (ids: string[]) => Promise<void> | void;
  onOpenBatchModal?: (defaultDate: string) => void;
  initialSchedule?: Partial<Schedule> | null;
  presets: Preset[];
  categories: CategoryItem[];
  schedules?: Schedule[];
  selectedDate?: string;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onSaveAsPreset,
  onUsePreset,
  onSavePreset,
  onDeletePreset,
  onReorderPresets,
  onOpenBatchModal,
  initialSchedule,
  presets,
  categories,
  schedules = [],
  selectedDate,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [isAllDay, setIsAllDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState<ScheduleCategory>('personal');
  const [memo, setMemo] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>('none');
  const [completed, setCompleted] = useState(false);
  const [continuousAdd, setContinuousAdd] = useState(false);
  const [showAdditionalOptions, setShowAdditionalOptions] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Phrase Manage Modal state
  const [isPhraseModalOpen, setIsPhraseModalOpen] = useState(false);
  const [phraseModalInitialType, setPhraseModalInitialType] = useState<PhraseType | 'all'>('title');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(initialSchedule?.id);

  // Title phrases & Memo phrases
  const titlePhrases = useMemo(() => {
    return presets.filter((p) => (p.type || 'title') === 'title');
  }, [presets]);

  const memoPhrases = useMemo(() => {
    return presets.filter((p) => p.type === 'memo');
  }, [presets]);

  useEffect(() => {
    if (isOpen) {
      if (initialSchedule && initialSchedule.id) {
        setTitle(initialSchedule.title || '');
        setDate(initialSchedule.date || selectedDate || new Date().toISOString().slice(0, 10));
        const hasTime = Boolean(initialSchedule.startTime);
        setIsAllDay(!hasTime);
        setStartTime(initialSchedule.startTime || '09:00');
        setEndTime(initialSchedule.endTime || '10:00');
        setCategory(initialSchedule.category || 'personal');
        setMemo(initialSchedule.memo || '');
        setCompleted(Boolean(initialSchedule.completed));
        setShowAdditionalOptions(hasTime || Boolean(initialSchedule.memo));
      } else {
        setTitle(initialSchedule?.title || '');
        setDate(initialSchedule?.date || selectedDate || new Date().toISOString().slice(0, 10));
        setIsAllDay(true);
        setStartTime('09:00');
        setEndTime('10:00');
        setCategory(initialSchedule?.category || categories[0]?.id || 'personal');
        setMemo('');
        setCompleted(false);
        setShowAdditionalOptions(false);
      }
      setIsPhraseModalOpen(false);
      setSaveError('');
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 80);
    }
  }, [isOpen, initialSchedule, selectedDate]);

  // Conflict detection
  const conflictingSchedule = useMemo(() => {
    if (isAllDay || !startTime || !endTime || !date) return null;
    return (
      schedules.find((s) => {
        if (initialSchedule?.id && s.id === initialSchedule.id) return false;
        if (s.date !== date || !s.startTime || !s.endTime) return false;
        return s.startTime < endTime && s.endTime > startTime;
      }) || null
    );
  }, [schedules, date, isAllDay, startTime, endTime, initialSchedule]);

  if (!isOpen) return null;

  // Apply title phrase from quick chips: fills title, keeps date/time intact
  const handleApplyTitlePhrase = async (phrase: Preset) => {
    try {
      await onUsePreset(phrase.id);
      setTitle(phrase.text);
      setSaveError('');
      titleInputRef.current?.focus();
    } catch {
      setSaveError('문구 사용 내역을 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  };

  // Selection from PhraseManageModal: fills title or memo, keeps date/time intact, closes modal
  const handleSelectPhraseFromModal = (phraseText: string, phrase: Preset) => {
    if (phrase.type === 'memo') {
      setMemo((prev) => (prev.trim() ? `${prev}\n${phraseText}` : phraseText));
      setShowAdditionalOptions(true);
    } else {
      setTitle(phraseText);
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
    setIsPhraseModalOpen(false);
  };

  // Quick save current title as new title phrase
  const handleSaveCurrentTitleAsPhrase = () => {
    const text = title.trim();
    if (!text) return;
    if (onSavePreset) {
      const now = Date.now();
      onSavePreset({
        id: `phrase-${now}-${Math.random().toString(36).substring(2, 7)}`,
        type: 'title',
        text,
        isFavorite: false,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    } else if (onSaveAsPreset) {
      onSaveAsPreset({
        type: 'title',
        text,
        isFavorite: false,
      });
    }
  };

  const handleShift30Min = () => {
    if (!startTime || !endTime) return;
    const newStart = addMinutesToTime(startTime, 30);
    const newEnd = addMinutesToTime(endTime, 30);
    setStartTime(newStart);
    setEndTime(newEnd);
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');

    const newSchedule: Schedule = {
      id: initialSchedule?.id || `sch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: trimmedTitle,
      date,
      startTime: isAllDay ? '' : startTime,
      endTime: isAllDay ? '' : endTime,
      category,
      completed,
      memo: memo.trim(),
    };

    try {
    if (continuousAdd && !isEditing) {
      await onSave(newSchedule, true);
      setTitle('');
      setMemo('');
      setTimeout(() => titleInputRef.current?.focus(), 50);
    } else {
      await onSave(newSchedule, false);
      onClose();
    }
    } catch {
      setSaveError('일정을 저장하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in" role="dialog" aria-modal="true" aria-label={isEditing ? '일정 수정' : '새 일정'}>
      {/* Mobile Bottom Sheet & Desktop Compact Modal */}
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-[#F0E7EB] overflow-hidden flex flex-col max-h-[90vh] pb-safe safe-bottom">
        {/* Mobile drag handle */}
        <div className="w-10 h-1 bg-[#F0E7EB] rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 py-3 border-b border-[#F0E7EB] flex items-center justify-between bg-white shrink-0">
          <h3 className="text-base font-bold text-[#3E3438]">
            {isEditing ? '일정 수정' : '새 일정'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#85777D] hover:text-[#3E3438] hover:bg-[#F6E8ED] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {saveError && <p role="alert" className="text-xs text-[#C4476B]">{saveError}</p>}
          {/* 1. Title Input & Phrase Trigger */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#3E3438]">일정 제목</label>
              <button
                type="button"
                onClick={() => {
                  setPhraseModalInitialType('title');
                  setIsPhraseModalOpen(true);
                }}
                className="text-xs font-semibold text-[#CF8FA8] hover:text-[#BD7F98] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFFAFB] border border-[#F0E7EB] hover:bg-[#F6E8ED] transition-colors cursor-pointer"
                title="자주 쓰는 문구 팝업 열기"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>자주 쓰는 문구</span>
              </button>
            </div>

            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="일정 제목을 입력하세요"
              className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl focus:outline-none focus:border-[#CF8FA8] text-[#3E3438] placeholder:text-[#85777D]/70 transition-colors"
            />

            {/* Quick Favorites Row (always available horizontal chips for fastest 1-tap input) */}
            {titlePhrases.filter((p) => p.isFavorite).length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-0.5 no-scrollbar">
                {titlePhrases
                  .filter((p) => p.isFavorite)
                  .slice(0, 5)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleApplyTitlePhrase(p)}
                      className="px-2.5 py-1 text-xs bg-[#FFFAFB] hover:bg-[#F6E8ED] text-[#3E3438] border border-[#F0E7EB] rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1 active:scale-95"
                      title="클릭하여 바로 입력"
                    >
                      <Star className="w-3 h-3 text-[#CF8FA8] fill-[#CF8FA8]" />
                      <span>{p.text}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* 2. Date Selection */}
          <div className="flex items-center justify-between p-2.5 bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#CF8FA8]" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-sm font-semibold text-[#3E3438] focus:outline-none cursor-pointer"
              />
            </div>

            {!isEditing && onOpenBatchModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBatchModal(date);
                }}
                className="text-xs text-[#CF8FA8] hover:underline cursor-pointer font-medium"
              >
                여러 날짜 선택
              </button>
            )}
          </div>

          {/* 3. Collapsible Additional Options Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdditionalOptions(!showAdditionalOptions)}
              className="w-full py-2 flex items-center justify-between text-xs font-semibold text-[#CF8FA8] hover:text-[#BD7F98] cursor-pointer"
            >
              <span>{showAdditionalOptions ? '추가 옵션 접기' : '+ 추가 옵션 (시간, 카테고리, 메모)'}</span>
              {showAdditionalOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* Collapsed by default */}
            {showAdditionalOptions && (
              <div className="space-y-4 pt-2 border-t border-[#F0E7EB] animate-in fade-in">
                {/* Time Setting */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[#3E3438]">시간</label>
                    <label className="flex items-center gap-1.5 text-xs text-[#85777D] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAllDay}
                        onChange={(e) => setIsAllDay(e.target.checked)}
                        className="rounded text-[#CF8FA8] focus:ring-0"
                      />
                      <span>종일 (시간 없음)</span>
                    </label>
                  </div>

                  {!isAllDay && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl text-xs">
                          <Clock className="w-3.5 h-3.5 text-[#85777D]" />
                          <input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full bg-transparent text-[#3E3438] focus:outline-none"
                          />
                        </div>
                        <span className="text-xs text-[#85777D]">~</span>
                        <div className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl text-xs">
                          <Clock className="w-3.5 h-3.5 text-[#85777D]" />
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full bg-transparent text-[#3E3438] focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Conflict Alert */}
                      {conflictingSchedule && (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="truncate">
                              겹침: {conflictingSchedule.title} ({conflictingSchedule.startTime})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleShift30Min}
                            className="px-2 py-0.5 text-[11px] font-semibold bg-amber-200 rounded-lg text-amber-900 cursor-pointer"
                          >
                            30분 연기
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Category Selection */}
                <div>
                  <label className="text-xs font-semibold text-[#3E3438] block mb-1.5">카테고리</label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat) => {
                      const isSelected = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-[#F4DCE5] border-[#CF8FA8] text-[#3E3438] font-bold shadow-2xs'
                              : 'bg-white border-[#F0E7EB] text-[#85777D] hover:bg-[#FFFAFB]'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: cat.color || '#CF8FA8' }}
                          />
                          <span>{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Memo with Memo Phrase Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#3E3438]">메모</label>
                    <button
                      type="button"
                      onClick={() => {
                        setPhraseModalInitialType('memo');
                        setIsPhraseModalOpen(true);
                      }}
                      className="text-xs font-semibold text-[#CF8FA8] hover:text-[#BD7F98] flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#FFFAFB] border border-[#F0E7EB] hover:bg-[#F6E8ED] transition-colors cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>자주 쓰는 문구</span>
                    </button>
                  </div>

                  <textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="상세 내용을 메모하세요"
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl focus:outline-none focus:border-[#CF8FA8] text-[#3E3438] resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#F0E7EB] bg-white flex items-center justify-between shrink-0">
          <div>
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (initialSchedule?.id) {
                    onDelete(initialSchedule.id);
                    onClose();
                  }
                }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                title="일정 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <label className="flex items-center gap-1.5 text-xs text-[#3E3438] cursor-pointer">
                <input
                  type="checkbox"
                  checked={continuousAdd}
                  onChange={(e) => setContinuousAdd(e.target.checked)}
                  className="rounded text-[#CF8FA8] focus:ring-0"
                />
                <span className="font-medium">계속 등록</span>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#85777D] hover:bg-[#F6E8ED] rounded-xl transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#CF8FA8] hover:bg-[#BD7F98] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              {isEditing ? '수정 완료' : continuousAdd ? '저장 후 계속' : '저장'}
            </button>
          </div>
        </div>
      </div>
      <PhraseManageModal
        isOpen={isPhraseModalOpen}
        onClose={() => setIsPhraseModalOpen(false)}
        presets={presets}
        initialType={phraseModalInitialType}
        onSelectPhrase={handleSelectPhraseFromModal}
        onSavePreset={onSavePreset}
        onDeletePreset={onDeletePreset}
        onReorderPresets={onReorderPresets}
        onUsePreset={onUsePreset}
      />
    </div>
  );
};
