import {ScheduleReminderField} from '../common/ScheduleReminderField';
import { RegistrationNotice, type RegistrationNoticeData } from '../common/RegistrationNotice';
import { MultipleDateSelection } from '../common/MultipleDateSelection';
import { CategoryGrid } from '../common/CategoryGrid';
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Schedule,
  ScheduleCategory,
  RecurrenceRule,
  Preset,
  PresetGroup,
  CategoryItem,
  PhraseType,
  TitleBlock,
} from '../../types';
import { getTodayDateString } from '../../utils/dateHelpers';
import { useMobileSheet, useRevealSheetPanel } from '../../hooks/useMobileSheet';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import { DiscardPrompt } from '../common/DiscardPrompt';
import { DatePicker } from '../common/DatePicker';
import { RepeatPicker } from '../common/RepeatPicker';
import { SCOPES } from './ConfirmDeleteDialog';
import type { SeriesScope } from '../../utils/seriesEdit';
import { NO_REPEAT, repeatError, repeatToRule, ruleToRepeat, type RepeatSettings } from '../../utils/repeat';
import { usePresetGroup } from '../../hooks/usePresetGroup';
import { InlinePresetPicker } from '../common/InlinePresetPicker';
import { TitleBlockEditor } from '../common/TitleBlockEditor';
import { TimeField } from '../common/TimeField';
import { phraseOrder } from '../../utils/phrases';
import {
  X,
  Clock,
  Calendar,
  Trash2,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Star, ImagePlus } from 'lucide-react';
import { PhraseManager } from './PhraseManageModal';
import { CategoryActions, CategoryManager } from './CategoryManager';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';

interface ScheduleModalProps extends CategoryActions {
  registrationNotice?:RegistrationNoticeData|null;
  onDismissRegistration?:()=>void;
  onUndoRegistration?:()=>Promise<void>;
  /** 사진으로 일정 넣기(새 일정일 때만 머리줄에 버튼) */
  onPhoto?: () => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenTask?: (id: string) => void;
  onOpenNote?: (id: string) => void;
  onSave: (schedule: Schedule, keepOpen?: boolean, rule?: RecurrenceRule | null, scope?: SeriesScope) => Promise<void> | void;
  onDelete?: (scheduleId: string, scope?: SeriesScope) => Promise<void> | void;
  onUsePreset: (presetId: string) => Promise<void> | void;
  onSavePreset: (preset: Preset) => Promise<void> | void;
  onDeletePreset: (presetId: string) => Promise<void> | void;
  onReorderPresets: (ids: string[]) => Promise<void> | void;
  initialBatch?: boolean;
  onSaveBatch: (schedule: Schedule, dates: string[]) => Promise<void>;
  initialSchedule?: Partial<Schedule> | null;
  recurrenceRules: RecurrenceRule[];
  presets: Preset[];
  presetGroups?: PresetGroup[];
  categories: CategoryItem[];
  schedules: Schedule[];
  selectedDate?: string;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  registrationNotice,onDismissRegistration,onUndoRegistration,
  isOpen,
  onClose,
  onOpenNote,
  onOpenTask,
  onSave,
  onPhoto,
  onDelete,
  onUsePreset,
  onSavePreset,
  onDeletePreset,
  onReorderPresets,
  onSaveCategory, onDeleteCategory, onReorderCategories,
  initialBatch = false, onSaveBatch,
  initialSchedule, recurrenceRules,
  presets, presetGroups = [],
  categories,
  schedules = [],
  selectedDate,
}) => {
  const importantBaseline = useRef(false), repeatBaseline = useRef('');
  const [repeat, setRepeat] = useState<RepeatSettings>(NO_REPEAT);
  const occurrence = Boolean(initialSchedule?.recurrenceRuleId && /_rec_\d{4}-\d{2}-\d{2}$/.test(initialSchedule.id || ''));
  const originalRule = recurrenceRules.find(r => r.id === initialSchedule?.recurrenceRuleId || r.scheduleId === initialSchedule?.id);
  const [isImportant, setIsImportant] = useState(false);
  const [selectedPresetGroup] = usePresetGroup(presetGroups, presets);
  const [title, setTitle] = useState('');
  const [titleBlocks, setTitleBlocks] = useState<TitleBlock[]>([]);
  const [date, setDate] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState<ScheduleCategory>('');
  const [reminderMinutes,setReminderMinutes]=useState<number|null|undefined>(undefined);
  const reminderBaseline=useRef<number|null|undefined>(undefined);
  const [memo, setMemo] = useState('');
  const [completed, setCompleted] = useState(false);
  const [continuousAdd, setContinuousAdd] = useState(false);
  const [showAdditionalOptions, setShowAdditionalOptions] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const scheduleDraftId = useRef(crypto.randomUUID());

  // Phrase Manage Modal state
  const [isPhraseModalOpen, setIsPhraseModalOpen] = useState(false);
  const [phraseModalInitialType, setPhraseModalInitialType] = useState<PhraseType | 'all'>('title');
  const [phraseMode, setPhraseMode] = useState<'select' | 'manage'>('select');
  const [applyMode, setApplyMode] = useState<'replace' | 'append'>('append');
  const [titleHistory, setTitleHistory] = useState<{ text: string; blocks: TitleBlock[] }[]>([]);
  const [phraseMessage, setPhraseMessage] = useState('');
  const [savingPhrase, setSavingPhrase] = useState(false);
  const savingPhraseRef = useRef(false);
  const titlePhraseDraftId = useRef<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(initialSchedule?.id);

  const [categoryPanel, setCategoryPanel] = useState<'select' | 'manage' | null>(null);
  const [datePanel, setDatePanel] = useState(false);
  const [inlinePresetsOpen, setInlinePresetsOpen] = useState(false);
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [panelDirty, setPanelDirty] = useState(false), [panelBusy, setPanelBusy] = useState(false);
  const [hasSaved, setHasSaved] = useState(false), [deleting, setDeleting] = useState(false), [askScope, setAskScope] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null), baseline = useRef('');
  const mobileSheet=useMobileSheet(isOpen,.9,'schedule');
  useRevealSheetPanel(isOpen && inlinePresetsOpen && !isPhraseModalOpen,modalRef,mobileSheet.expand);
  const allDates = [...new Set([date, ...extraDates])].filter(Boolean).sort();
  const snapshot = (t: string, d: string, all: boolean, start: string, end: string, cat: string, note: string, done: boolean, extra: string[], blocks: TitleBlock[] = []) => JSON.stringify([t, d, all, all ? '' : start, all ? '' : end, cat, note, done, extra, blocks.map(b => [b.text, b.presetId])]);
  const dirty = reminderMinutes!==reminderBaseline.current || JSON.stringify(repeat) !== repeatBaseline.current || isImportant !== importantBaseline.current || snapshot(title, date, isAllDay, startTime, endTime, category, memo, completed, extraDates, titleBlocks) !== baseline.current;
  const closeGuard = useDiscardGuard(dirty || panelDirty, saving || savingPhrase || panelBusy);
  const panelGuard = useDiscardGuard(panelDirty, saving || panelBusy);
  const returnToSchedule = () => { setIsPhraseModalOpen(false); setCategoryPanel(null); setDatePanel(false); setPanelDirty(false); setPanelBusy(false); requestAnimationFrame(() => titleInputRef.current?.focus()); };
  const requestBack = () => {
    if (panelGuard.confirming) { panelGuard.cancel(); return false; }
    if (inlinePresetsOpen && !isPhraseModalOpen && !categoryPanel && !datePanel) { setInlinePresetsOpen(false); requestAnimationFrame(()=>titleInputRef.current?.focus({preventScroll:true})); return true; }
    if (datePanel) { returnToSchedule(); return true; }
    return panelGuard.request(() => { if (categoryPanel === 'manage') { setCategoryPanel('select'); setPanelDirty(false); } else returnToSchedule(); });
  };
  const requestClose = () => {
    if (closeGuard.confirming) { closeGuard.cancel(); return false; }
    return closeGuard.request(onClose);
  };
  const panelOpen = isPhraseModalOpen || Boolean(categoryPanel) || datePanel;
  useScheduleDialog(isOpen, panelOpen || inlinePresetsOpen, modalRef, requestClose, requestBack);
  useLayoutEffect(() => {
    if (!isOpen) {setInlinePresetsOpen(false);return;}
    const t = initialSchedule?.title || '', d = initialSchedule?.date || selectedDate || getTodayDateString();
    const all = isEditing || initialSchedule?.startTime !== undefined ? !initialSchedule?.startTime : false, start = initialSchedule?.startTime || '09:00', end = initialSchedule?.endTime || '10:00';
    const cat = initialSchedule?.category ?? '', note = initialSchedule?.memo || '', done = Boolean(initialSchedule?.completed);
    const savedBlocks = initialSchedule?.titleBlocks;
    const parts: TitleBlock[] = Array.isArray(savedBlocks) && savedBlocks.every(b => b && typeof b.id === 'string' && typeof b.text === 'string') && savedBlocks.map(b => b.text).join(' ') === t ? savedBlocks : t ? [{ id: crypto.randomUUID(), text: t }] : [];
    setTitleBlocks(parts);
    const initialRepeat = ruleToRepeat(originalRule);
    setRepeat(initialRepeat); repeatBaseline.current = JSON.stringify(initialRepeat);
    importantBaseline.current = Boolean(initialSchedule?.isImportant);
    setIsImportant(importantBaseline.current);
    reminderBaseline.current=initialSchedule?.reminderMinutes;setReminderMinutes(reminderBaseline.current);
    setTitle(t); setDate(d); setIsAllDay(all); setStartTime(start); setEndTime(end); setCategory(cat); setMemo(note); setCompleted(done);
    setShowAdditionalOptions(Boolean(note || originalRule || initialSchedule?.reminderMinutes!==undefined)); setExtraDates([]); setDatePanel(initialBatch);
    setIsPhraseModalOpen(false); setInlinePresetsOpen(false); setPhraseMode('select'); setPhraseModalInitialType('title'); setCategoryPanel(null); setPanelDirty(false); setPanelBusy(false); setHasSaved(false); scheduleDraftId.current = crypto.randomUUID(); setContinuousAdd(false); setDeleting(false); setAskScope(false);
    closeGuard.cancel(); panelGuard.cancel();
    setSaveError(''); setApplyMode('append'); setTitleHistory([]); setPhraseMessage(''); titlePhraseDraftId.current = null;
    baseline.current = snapshot(t, d, all, start, end, cat, note, done, [], parts);
    const timer = window.setTimeout(() => titleInputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [isOpen, initialSchedule, selectedDate, initialBatch]);

  if (!isOpen) return null;

  // Apply immediately; usage tracking must not block title entry or schedule saving.
  const trackUse = (phrase: Preset) => {
    void Promise.resolve().then(() => onUsePreset(phrase.id)).catch(() => {
      setSaveError('제목은 적용됐지만 프리셋 사용 내역을 저장하지 못했습니다. 일정은 그대로 저장할 수 있습니다.');
    });
  };

  const handleApplyTitlePhrase = (phrase: Preset) => {
    const previous = titleInputRef.current?.value ?? title;
    const next = applyMode === 'append' && previous.trim()
      ? previous.trimEnd() + ' ' + phrase.text : phrase.text;
    if (next !== previous) setTitleHistory(history => [...history, { text: previous, blocks: titleBlocks }]);
    setTitle(next);
    setTitleBlocks([{ id: crypto.randomUUID(), text: next, presetId: phrase.id }]);
    setPhraseMessage('');
    setSaveError('');
    trackUse(phrase);
  };

  const handleRestoreTitle = () => {
    if (!titleHistory.length) return;
    const restored = titleHistory[titleHistory.length - 1];
    setTitle(restored.text);
    setTitleBlocks(restored.blocks);
    setTitleHistory(history => history.slice(0, -1));
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
    returnToSchedule();
  };

  const handleSaveCurrentTitleAsPhrase = async () => {
    const text = title.trim();
    if (!text || savingPhraseRef.current) return;
    if (presets.some(p => (p.type || 'title') === 'title' && p.text.trim() === text && (p.groupId || '') === selectedPresetGroup)) {
      setPhraseMessage('이미 저장된 프리셋입니다.');
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
        id: titlePhraseDraftId.current, groupId: selectedPresetGroup || undefined, type: 'title', text,
        ...(titleBlocks.length && titleBlocks.every(b => b.text.trim()) && titleBlocks.map(b => b.text).join(' ') === text ? { blocks: titleBlocks.map(b => ({ ...b })) } : {}),
        isFavorite: false, usageCount: 0, lastUsedAt: 0,
        sortOrder: Math.max(0, ...presets.map(phraseOrder)) + 1,
        createdAt: now, updatedAt: now,
      });
      titlePhraseDraftId.current = null;
      setPhraseMessage('현재 제목을 프리셋으로 저장했습니다.');
    } catch {
      setSaveError('프리셋을 저장하지 못했습니다. 일정 입력 내용은 유지됩니다. 다시 시도해 주세요.');
    } finally {
      savingPhraseRef.current = false;
      setSavingPhrase(false);
    }
  };

  const handleSave = async (composition?: TitleBlock[], scope?: SeriesScope): Promise<boolean> => {
    const trimmedTitle = (composition ? composition.map(b => b.text).join(' ') : title).trim();
    if (!trimmedTitle || savingRef.current) return false;
    if (titleBlocks.some(b => !b.text.trim())) { setSaveError('빈 제목 블록을 입력하거나 제거해 주세요.'); return false; }
    if (category && !categories.some(cat => cat.id === category)) { setSaveError('없는 카테고리입니다. 다시 선택해 주세요.'); setCategoryPanel('select'); return false; }
    if (!date) { setSaveError('날짜를 선택해 주세요.'); return false; }
    const repeatProblem = repeatError(repeat, date);
    if (repeatProblem) { setSaveError(repeatProblem); return false; }
    // 반복 일정의 한 회차: 어디까지 바꿀지 먼저 묻는다
    if (occurrence && !scope) { setSaveError(''); setDeleting(false); setAskScope(true); return false; }
    setAskScope(false);
    if (!isEditing && allDates.length > 1 && repeat.frequency !== 'none') { setSaveError('반복 일정은 하나의 기준 날짜로 등록해 주세요.'); return false; }
    if (!isAllDay && (!startTime || !endTime || endTime <= startTime)) { setSaveError('종료 시간은 시작 시간보다 늦게 설정해 주세요.'); return false; }
    savingRef.current = true;
    setSaving(true);
    setSaveError('');

    const newSchedule: Schedule = {
      ...initialSchedule,
      id: initialSchedule?.id || scheduleDraftId.current,
      title: trimmedTitle,
      date,
      startTime: isAllDay ? '' : startTime,
      endTime: isAllDay ? '' : endTime,
      category,
      completed,
      isImportant,
      memo: memo.trim(),
      reminderMinutes,
    };

    const repeatChanged = JSON.stringify(repeat) !== repeatBaseline.current;
    const rule: RecurrenceRule | null | undefined = (occurrence && (scope === 'this' || !repeatChanged)) || (isEditing && !repeatChanged) || (!isEditing && repeat.frequency === 'none') ? undefined
      : repeatToRule(repeat, { id: originalRule?.id || newSchedule.id + '-repeat', scheduleId: newSchedule.id, startDate: occurrence ? date : originalRule?.startDate || date }, occurrence ? undefined : originalRule);
    const parts = composition ?? titleBlocks;
    if (parts.map(b => b.text).join(' ').trim() === trimmedTitle && (parts.length > 1 || parts.some(b => b.presetId))) newSchedule.titleBlocks = parts;
    else delete newSchedule.titleBlocks;
    try {
    if (!isEditing && allDates.length > 1) {
      await onSaveBatch(newSchedule, allDates);
      onClose();
    } else if (continuousAdd && !isEditing) {
      await onSave(newSchedule, true, rule);
      setTitle(''); setTitleBlocks([]);
      setMemo(''); reminderBaseline.current=reminderMinutes; setIsImportant(false); importantBaseline.current = false; repeatBaseline.current = JSON.stringify(repeat);
      setTitleHistory([]);
      setPhraseMessage(''); setHasSaved(true); scheduleDraftId.current = crypto.randomUUID();
      baseline.current = snapshot('', date, isAllDay, startTime, endTime, category, '', completed, extraDates);
      setTimeout(() => titleInputRef.current?.focus(), 50);
    } else {
      await onSave(newSchedule, false, rule, scope);
      onClose();
    }
    return true;
    } catch {
      setSaveError('일정을 저장하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.');
      return false;
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
    <div ref={modalRef} data-schedule-overlay className="app-modal fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[rgba(52,40,35,0.30)]" role="dialog" aria-modal="true" aria-label={isEditing ? '일정 수정' : '새 일정'}>
      {/* Mobile Bottom Sheet & Desktop Compact Modal */}
      <div ref={mobileSheet.surfaceRef} style={categoryPanel ? { ...mobileSheet.style, height: 'auto', minHeight: 0 } : mobileSheet.style} className="w-full sm:max-w-md bg-white rounded-2xl shadow-xl border border-app-line overflow-hidden flex flex-col max-h-[min(90dvh,var(--modal-height,100dvh))] pb-safe safe-bottom">
        {/* Mobile drag handle */}
        <button {...mobileSheet.handleProps} className="mobile-sheet-handle sm:hidden shrink-0 w-full flex items-center justify-center cursor-grab active:cursor-grabbing"><span className="w-10 h-1 bg-app-outline rounded-full"/></button>

        {registrationNotice&&<RegistrationNotice key={registrationNotice.id} notice={registrationNotice} onDismiss={onDismissRegistration} onUndo={onUndoRegistration} container={modalRef.current}/>}
        {panelGuard.confirming && <DiscardPrompt onContinue={panelGuard.cancel} onDiscard={panelGuard.discard} />}
        {closeGuard.confirming && <DiscardPrompt actionLabel={isEditing ? '수정 취소' : '등록 취소'} title={isEditing ? '수정을 취소할까요?' : '등록을 취소할까요?'} onContinue={closeGuard.cancel} onDiscard={closeGuard.discard} />}
        {saveError && <p role="alert" className="px-4 py-2 text-xs text-[#C4476B]">{saveError}</p>}
        {panelOpen && <div data-schedule-panel className="px-3 py-2 overflow-y-auto min-h-0">
          <div className="flex items-center justify-between mb-1.5"><h3 className="font-bold text-sm">{datePanel ? '여러 날짜 선택' : isPhraseModalOpen ? '프리셋 관리' : categoryPanel === 'manage' ? '카테고리 관리' : '카테고리 선택'}</h3><button type="button" className="min-h-10 px-2 text-sm" onClick={requestBack}>뒤로</button></div>
          {datePanel ? <div className="space-y-3">
            <p className="text-xs text-app-muted">같은 내용으로 등록할 날짜를 선택하세요. 작성 중인 내용은 유지됩니다.</p>
            <MultipleDateSelection baseDate={date} dates={allDates} onDone={returnToSchedule} onChange={(base,dates)=>{setDate(base);setExtraDates(dates.filter(value=>value!==base));}}/>
          </div> : isPhraseModalOpen ? <>
            <PhraseManager hideSearch presetGroups={presetGroups} onDirtyChange={setPanelDirty} onBusyChange={setPanelBusy} presets={presets} initialType={phraseModalInitialType} initialMode={phraseMode} onSelectPhrase={phraseModalInitialType === 'memo' ? handleSelectPhraseFromModal : undefined} onSavePreset={onSavePreset} onDeletePreset={onDeletePreset} onReorderPresets={onReorderPresets}
              initialBlocks={titleBlocks.length > 1 || titleBlocks.some(b => b.presetId) ? titleBlocks : []} existingTitle={title}
              onApplyComposition={undefined}
            />
          </> : categoryPanel === 'manage' ? <CategoryManager onDirtyChange={setPanelDirty} onBusyChange={setPanelBusy} categories={categories} schedules={schedules} onSaveCategory={onSaveCategory} onDeleteCategory={async id => { await onDeleteCategory(id); if (category === id) setCategory(''); }} onReorderCategories={onReorderCategories} onCreated={id => { setCategory(id); returnToSchedule(); }} /> : <div className="space-y-2">
            <CategoryGrid categories={categories} value={category} onChange={id=>{setCategory(id);returnToSchedule();}}/>
            <button type="button" aria-pressed={!category} className="w-full min-h-10 px-3 rounded-xl border border-app-line text-sm" onClick={()=>{setCategory('');returnToSchedule();}}>카테고리 없음 (미분류)</button>
            <button type="button" className="min-h-10 px-3 text-app-accent-ink" onClick={() => setCategoryPanel('manage')}>카테고리 관리</button>
            <button type="button" className="min-h-9 px-3 text-app-accent-ink" onClick={() => { setCategoryPanel('manage'); requestAnimationFrame(() => modalRef.current?.querySelector<HTMLInputElement>('#category-name')?.focus()); }}>새 카테고리 추가</button>
          </div>}
        </div>}
        <div inert={saving} aria-busy={saving} className={panelOpen ? 'hidden' : 'flex flex-col min-h-0 min-w-0'}>
        {/* Header */}
        <div className="px-3 py-2 border-b border-app-line flex items-center justify-between bg-white shrink-0">
          <h3 className="text-base font-bold text-app-ink flex-1">
            {isEditing ? '일정 수정' : '새 일정'}
          </h3>
          {!isEditing && onPhoto && <button type="button" data-photo-entry onClick={onPhoto} aria-label="사진으로 일정 넣기" className="mr-1 inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-app-accent bg-app-soft px-3.5 text-sm font-bold text-[#7E4560] cursor-pointer"><ImagePlus className="h-4 w-4" aria-hidden="true" />사진으로</button>}
          <button
            type="button"
            onClick={requestClose}
            aria-label={isEditing ? '일정 수정창 닫기' : '일정 등록창 닫기'}
            className="p-1 text-app-muted hover:text-app-ink hover:bg-app-soft rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div data-sheet-scroll className="px-3 py-2 sm:px-4 space-y-1.5 overflow-y-auto min-h-0 flex-1">
          {/* 1. Title Input & Phrase Trigger */}
          <div>
            <label className="block text-xs font-semibold text-app-ink mb-1" htmlFor="schedule-title">일정 제목</label>

            <div className="flex gap-2 items-center">
            <button type="button" aria-label="중요 일정" aria-pressed={isImportant} onClick={() => setIsImportant(v => !v)} className="shrink-0 text-app-accent-ink"><Star className={`w-5 h-5 ${isImportant ? 'fill-current' : ''}`} /></button>
            <input
              id="schedule-title"
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleBlocks(e.target.value ? [{ id: crypto.randomUUID(), text: e.target.value }] : []); }}
              onKeyDown={handleKeyDown}
              placeholder="일정 제목을 입력하세요"
              className="w-full min-w-0 px-3 py-1.5 text-base sm:text-sm bg-app-canvas border border-app-line rounded-xl focus:outline-none focus:border-app-accent text-app-ink placeholder:text-app-muted/70 transition-colors"
            />

              <button type="button" className="shrink-0 min-h-9 px-3 bg-app-soft rounded-xl text-sm text-app-accent-ink" aria-expanded={inlinePresetsOpen} onClick={() => setInlinePresetsOpen(value => !value)}>프리셋</button>
            </div>
            {(titleBlocks.length > 1 || titleBlocks.some(b => b.presetId)) && <div className="mt-2"><TitleBlockEditor blocks={titleBlocks} word="" onWordChange={() => {}} onChange={parts => { setTitleBlocks(parts); setTitle(parts.map(b => b.text).join(' ')); }} editable compact hideWordInput /></div>}
            {inlinePresetsOpen && <InlinePresetPicker selectedBlocks={titleBlocks} options={<label className="flex items-center gap-2 text-xs min-h-9">적용 방식<select aria-label="프리셋 적용 방식" value={applyMode} onChange={e=>setApplyMode(e.target.value as 'replace'|'append')} className="min-h-9 bg-white border rounded-lg px-2"><option value="replace">제목 교체</option><option value="append">이어 붙이기</option></select></label>} presets={presets} presetGroups={presetGroups} onClose={() => { setInlinePresetsOpen(false); requestAnimationFrame(()=>titleInputRef.current?.focus({preventScroll:true})); }} onManage={() => { setPhraseModalInitialType('title'); setPhraseMode('manage'); setIsPhraseModalOpen(true); }} onAdd={(parts, preset) => {
              const previous = titleInputRef.current?.value ?? title;
              const current = titleBlocks.map(b => b.text).join(' ') === previous ? titleBlocks : previous.trim() ? [{ id: crypto.randomUUID(), text: previous }] : [];
              const next = applyMode === 'append' ? [...current, ...parts] : parts; setTitleHistory(history => [...history, { text: previous, blocks: titleBlocks }]); setTitleBlocks(next); setTitle(next.map(b => b.text).join(' ')); trackUse(preset); setPhraseMessage(''); setApplyMode('append');
            }} />}
            <div className="flex items-center justify-end gap-2">

              {titleHistory.length > 0 && <button type="button" onClick={handleRestoreTitle} className="min-h-9 text-xs text-app-accent-ink">이전 제목 복구</button>}
            </div>
            {phraseMessage && <p role="status" aria-label="프리셋 알림" className="text-xs text-app-muted">{phraseMessage}</p>}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold">날짜</span>{!isEditing && <button type="button" className="schedule-inline-action text-xs text-app-accent-ink px-1" onClick={() => setDatePanel(true)}>{allDates.length > 1 ? allDates.length + '개 날짜' : '여러 날짜 선택'}</button>}</div>
            <DatePicker label="일정 날짜" value={date} onChange={setDate} />
          </div>

                {/* Time Setting */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-app-ink">시간</label>
                    <label className="flex items-center gap-1.5 text-xs text-app-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAllDay}
                        onChange={(e) => setIsAllDay(e.target.checked)}
                        className="rounded text-app-accent-ink focus:ring-0"
                      />
                      <span>종일 (시간 없음)</span>
                    </label>
                  </div>

                  {!isAllDay && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-1.5 px-3 py-0.5 bg-app-canvas border border-app-line rounded-xl text-xs">
                          <Clock className="w-3.5 h-3.5 text-app-muted" />
                          <TimeField label="시작 시간" value={startTime} onChange={setStartTime} />
                        </div>
                        <span className="text-xs text-app-muted">~</span>
                        <div className="flex-1 flex items-center gap-1.5 px-3 py-0.5 bg-app-canvas border border-app-line rounded-xl text-xs">
                          <Clock className="w-3.5 h-3.5 text-app-muted" />
                          <TimeField label="종료 시간" value={endTime} onChange={setEndTime} />
                        </div>
                      </div>


                    </div>
                  )}
                </div>

          <div><label className="block text-xs font-semibold mb-1">카테고리</label><button type="button" aria-label="카테고리 선택" className="w-full flex items-center gap-2 px-3 py-2.5 border border-app-line rounded-xl text-sm" onClick={() => setCategoryPanel('select')}><span className="w-2.5 h-2.5 rounded-full" style={{ background: categories.find(c => c.id === category)?.color || '#D6CCD0' }} />{categories.find(c => c.id === category)?.name || '미분류'}<ChevronDown className="w-4 h-4 ml-auto" /></button></div>
          {/* 3. Collapsible Additional Options Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdditionalOptions(!showAdditionalOptions)}
              className="w-full py-2 flex items-center justify-between text-xs font-semibold text-app-accent-ink hover:text-app-accent-ink cursor-pointer"
            >
              <span>{showAdditionalOptions ? '상세 옵션 접기' : '+ 상세 옵션 (메모)'}</span>
              {showAdditionalOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* Collapsed by default */}
            {showAdditionalOptions && (
              <div className="space-y-3 pt-2 border-t border-app-line animate-in fade-in">
              <button type="button" disabled={!title.trim() || savingPhrase} onClick={() => void handleSaveCurrentTitleAsPhrase()} className="min-h-9 text-xs text-app-accent-ink disabled:opacity-40">프리셋으로 저장</button>
                <div className="space-y-2">
                  {occurrence && <p className="text-xs text-app-muted">반복 일정입니다. 저장할 때 바꿀 범위를 고릅니다.</p>}
                  {<>
                    <RepeatPicker key={isOpen ? initialSchedule?.id || "new" : "closed"} idPrefix="schedule" value={repeat} onChange={setRepeat} date={date} />
                  </>}
                </div>
                <ScheduleReminderField value={reminderMinutes} onChange={setReminderMinutes} allDay={isAllDay}/>
                {/* Memo with Memo Phrase Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-app-ink">메모</label>
                    <button
                      type="button"
                      onClick={() => {
                        setPhraseModalInitialType('memo');
                        setPhraseMode('select');
                        setIsPhraseModalOpen(true);
                      }}
                      className="text-xs font-semibold text-app-accent-ink hover:text-app-accent-ink flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-app-canvas border border-app-line hover:bg-app-soft transition-colors cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>자주 쓰는 메모</span>
                    </button>
                  </div>

                  <textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="상세 내용을 메모하세요"
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-app-canvas border border-app-line rounded-xl focus:outline-none focus:border-app-accent text-app-ink resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {deleting && <div role="group" aria-label="일정 삭제 확인" className="p-3 mx-4 bg-app-canvas border border-app-line rounded-xl text-sm">
          <p>{occurrence ? '반복 일정입니다. 어디까지 삭제할까요? 삭제 후 실행 취소할 수 있습니다.' : '이 일정을 삭제할까요? 삭제 후 실행 취소할 수 있습니다.'}</p>
          <div className={occurrence ? 'grid gap-1.5 mt-2' : 'flex justify-end gap-2'}>
            {(occurrence ? SCOPES : [['this', ''] as [SeriesScope, string]]).map(([scope, label]) => <button key={scope} type="button" disabled={saving} onClick={async () => { if (!initialSchedule?.id || savingRef.current) return; savingRef.current = true; setSaving(true); try { await onDelete?.(initialSchedule.id, scope); onClose(); } catch { setSaveError('일정을 삭제하지 못했습니다. 다시 시도해 주세요.'); } finally { savingRef.current = false; setSaving(false); } }} className={occurrence ? 'min-h-9 px-3 rounded-lg bg-white border border-app-line text-red-600 text-left' : 'text-red-600 px-3'}>{label ? label + ' 삭제' : '삭제'}</button>)}
            <button type="button" className={occurrence ? 'min-h-9' : ''} onClick={() => setDeleting(false)}>취소</button>
          </div>
        </div>}
        {askScope && <div role="group" aria-label="반복 일정 수정 범위" className="p-3 mx-4 bg-app-canvas border border-app-line rounded-xl text-sm">
          <p>반복 일정입니다. 어디까지 바꿀까요?</p>
          {JSON.stringify(repeat) !== repeatBaseline.current && <p className="text-xs text-app-muted mt-1">반복 설정을 바꾸면 '이 일정만'은 고를 수 없습니다.</p>}
          <div className="grid gap-1.5 mt-2">
            {SCOPES.map(([scope, label]) => <button key={scope} type="button" disabled={saving || (scope === 'this' && JSON.stringify(repeat) !== repeatBaseline.current)} onClick={() => void handleSave(undefined, scope)} className="min-h-9 px-3 rounded-lg bg-white border border-app-line text-app-ink text-left disabled:opacity-40">{label} 저장</button>)}
            <button type="button" className="min-h-9" onClick={() => setAskScope(false)}>취소</button>
          </div>
        </div>}
        {initialSchedule?.sourceNoteId && onOpenNote && <button type="button" className="mx-3 min-h-8 text-left text-xs text-app-accent-ink hover:underline" onClick={()=>closeGuard.request(()=>onOpenNote(initialSchedule.sourceNoteId!))}>원본 메모 열기</button>}
        {initialSchedule?.sourceTaskId && onOpenTask && <button type="button" className="mx-3 min-h-8 text-left text-xs text-app-accent-ink hover:underline" onClick={()=>closeGuard.request(()=>onOpenTask(initialSchedule.sourceTaskId!))}>원본 할 일 열기</button>}
        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-app-line bg-white flex items-center justify-between shrink-0">
          <div>
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={() => { setAskScope(false); setDeleting(true); }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                title="일정 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <label className="flex items-center gap-1.5 text-xs text-app-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={continuousAdd}
                  onChange={(e) => setContinuousAdd(e.target.checked)}
                  className="rounded text-app-accent-ink focus:ring-0"
                />
                <span className="font-medium">계속 등록</span>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="px-4 py-2 text-xs font-medium text-app-muted hover:bg-app-soft rounded-xl transition-colors cursor-pointer"
            >
              {hasSaved && !dirty ? '닫기' : '취소'}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!title.trim() || saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-app-accent-ink hover:bg-app-accent-ink-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              {saving ? '저장 중…' : isEditing ? '변경사항 저장' : continuousAdd ? '등록 후 계속' : allDates.length > 1 ? allDates.length + '개 등록' : '등록'}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
