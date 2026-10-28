import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Schedule,
  ScheduleCategory,
  Preset,
  CategoryItem,
  PhraseType,
} from '../../types';
import { getQuickPresets, phraseOrder } from '../../utils/phrases';
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
  Edit2,
  RotateCcw,
} from 'lucide-react';
import { PhraseManageModal } from './PhraseManageModal';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: Schedule, keepOpen?: boolean) => Promise<void> | void;
  onDelete?: (scheduleId: string) => void;
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
  const [completed, setCompleted] = useState(false);
  const [continuousAdd, setContinuousAdd] = useState(false);
  const [showAdditionalOptions, setShowAdditionalOptions] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Phrase Manage Modal state
  const [isPhraseModalOpen, setIsPhraseModalOpen] = useState(false);
  const [phraseModalInitialType, setPhraseModalInitialType] = useState<PhraseType | 'all'>('title');
  const [phraseMode, setPhraseMode] = useState<'select' | 'manage'>('select');
  const [applyMode, setApplyMode] = useState<'replace' | 'append'>('replace');
  const [titleHistory, setTitleHistory] = useState<string[]>([]);
  const [appliedText, setAppliedText] = useState('');
  const [phraseMessage, setPhraseMessage] = useState('');
  const [savingPhrase, setSavingPhrase] = useState(false);
  const savingPhraseRef = useRef(false);
  const titlePhraseDraftId = useRef<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(initialSchedule?.id);

  const quickPhrases = useMemo(() => getQuickPresets(presets), [presets]);

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
      setApplyMode('replace');
      setTitleHistory([]);
      setAppliedText('');
      setPhraseMessage('');
      titlePhraseDraftId.current = null;
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

  // Apply immediately; usage tracking must not block title entry or schedule saving.
  const trackUse = (phrase: Preset) => {
    void Promise.resolve().then(() => onUsePreset(phrase.id)).catch(() => {
      setSaveError('제목은 적용됐지만 문구 사용 내역을 저장하지 못했습니다. 일정은 그대로 저장할 수 있습니다.');
    });
  };

  const handleApplyTitlePhrase = (phrase: Preset) => {
    const previous = titleInputRef.current?.value ?? title;
    const next = applyMode === 'append' && previous.trim()
      ? previous.trimEnd() + ' ' + phrase.text : phrase.text;
    if (next !== previous) setTitleHistory(history => [...history, previous]);
    setTitle(next);
    setAppliedText(phrase.text);
    setPhraseMessage('');
    setSaveError('');
    trackUse(phrase);
  };

  const handleRestoreTitle = () => {
    if (!titleHistory.length) return;
    setTitle(titleHistory[titleHistory.length - 1]);
    setTitleHistory(history => history.slice(0, -1));
    setAppliedText('');
    setPhraseMessage('이전 제목을 복구했습니다.');
  };

  const handleSelectPhraseFromModal = (_text: string, phrase: Preset) => {
    if (phrase.type === 'memo') {
      setMemo(prev => prev.trim() ? prev + '\n' + phrase.text : phrase.text);
      setShowAdditionalOptions(true);
      trackUse(phrase);
    } else {
      handleApplyTitlePhrase(phrase);
    }
    setIsPhraseModalOpen(false);
  };

  const handleSaveCurrentTitleAsPhrase = async () => {
    const text = title.trim();
    if (!text || savingPhraseRef.current) return;
    if (presets.some(p => (p.type || 'title') === 'title' && p.text.trim() === text)) {
      setPhraseMessage('이미 저장된 문구입니다.');
      return;
    }
    savingPhraseRef.current = true;
    setSavingPhrase(true);
    setSaveError('');
    setPhraseMessage('');
    try {
      const now = Date.now();
      titlePhraseDraftId.current ??= crypto.randomUUID();
      await onSavePreset({
        id: titlePhraseDraftId.current, type: 'title', text,
        isFavorite: false, usageCount: 0, lastUsedAt: 0,
        sortOrder: Math.max(0, ...presets.map(phraseOrder)) + 1,
        createdAt: now, updatedAt: now,
      });
      titlePhraseDraftId.current = null;
      setPhraseMessage('현재 제목을 문구로 저장했습니다.');
    } catch {
      setSaveError('문구를 저장하지 못했습니다. 일정 입력 내용은 유지됩니다. 다시 시도해 주세요.');
    } finally {
      savingPhraseRef.current = false;
      setSavingPhrase(false);
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
      setTitleHistory([]);
      setAppliedText('');
      setPhraseMessage('');
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
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in" role="dialog" aria-modal="true" aria-label={isEditing ? '일정 수정' : '새 일정'}>
      {/* Mobile Bottom Sheet & Desktop Compact Modal */}
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-[#F0E7EB] overflow-hidden flex flex-col max-h-[90dvh] pb-safe safe-bottom">
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
            <label className="block text-xs font-semibold text-[#3E3438] mb-1.5" htmlFor="schedule-title">일정 제목</label>

            <input
              id="schedule-title"
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="일정 제목을 입력하세요"
              className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-[#FFFAFB] border border-[#F0E7EB] rounded-xl focus:outline-none focus:border-[#CF8FA8] text-[#3E3438] placeholder:text-[#85777D]/70 transition-colors"
            />

            <section aria-label="자주 쓰는 문구 빠른 선택" className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#85777D]">자주 쓰는 문구</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => { setPhraseModalInitialType('title'); setPhraseMode('select'); setIsPhraseModalOpen(true); }} className="min-h-9 px-2 text-xs text-[#CF8FA8] hover:bg-[#F6E8ED] rounded-lg">더보기</button>
                  <button type="button" onClick={() => { setPhraseModalInitialType('title'); setPhraseMode('manage'); setIsPhraseModalOpen(true); }} className="min-h-9 px-2 text-xs text-[#85777D] hover:bg-[#F6E8ED] rounded-lg"><Edit2 className="inline w-3 h-3 mr-1" />편집</button>
                </div>
              </div>
              {quickPhrases.length ? <div className="flex gap-1.5 min-w-0 flex-wrap">
                {quickPhrases.map(p => <button key={p.id} type="button" title={p.text} onPointerDown={e => e.preventDefault()} onClick={() => handleApplyTitlePhrase(p)} className="min-h-10 max-w-full px-2.5 py-1 text-xs text-[#3E3438] bg-[#FFFAFB] border border-[#F0E7EB] hover:bg-[#F6E8ED] rounded-lg inline-flex items-center gap-1">
                  {p.isFavorite && <Star className="w-3 h-3 shrink-0 text-[#CF8FA8] fill-[#CF8FA8]" />}<span className="truncate max-w-[230px]">{p.text}</span>
                </button>)}
              </div> : <p className="text-xs text-[#85777D]">아직 문구가 없습니다. 더보기에서 새 문구를 추가하세요.</p>}
              <div className="flex flex-wrap items-center justify-between gap-1">
                <div role="group" aria-label="문구 적용 방식" className="flex gap-0.5">
                  {(['replace', 'append'] as const).map(mode => <button key={mode} type="button" aria-pressed={applyMode === mode} onPointerDown={e => e.preventDefault()} onClick={() => setApplyMode(mode)} className={
                    'min-h-9 px-2 rounded-lg text-[11px] ' + (applyMode === mode ? 'text-[#BD7F98] bg-[#F6E8ED]' : 'text-[#85777D] hover:bg-[#FFFAFB]')
                  }>{mode === 'replace' ? '교체' : '이어 붙이기'}</button>)}
                </div>
                <button type="button" disabled={!title.trim() || savingPhrase} onPointerDown={e => e.preventDefault()} onClick={() => void handleSaveCurrentTitleAsPhrase()} className="min-h-9 px-1 text-[11px] text-[#CF8FA8] disabled:opacity-40 hover:underline">자주 쓰는 문구로 저장</button>
              </div>
              {appliedText && <p role="status" className="text-xs text-[#85777D] break-words max-h-16 overflow-y-auto">적용 문구: {appliedText}</p>}
              {titleHistory.length > 0 && <button type="button" onPointerDown={e => e.preventDefault()} onClick={handleRestoreTitle} className="min-h-9 text-xs text-[#BD7F98] hover:underline"><RotateCcw className="inline w-3.5 h-3.5 mr-1" />이전 제목 복구</button>}
              {phraseMessage && <p role="status" className="text-xs text-[#85777D]">{phraseMessage}</p>}
            </section>
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
                        setPhraseMode('select');
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
        initialMode={phraseMode}
      />
    </div>
  );
};
