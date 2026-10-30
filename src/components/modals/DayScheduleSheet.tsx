import { RegistrationNotice, type RegistrationNoticeData } from '../common/RegistrationNotice';
import { CalendarDateMenu } from '../common/CalendarDateMenu';
import { CategoryGrid } from '../common/CategoryGrid';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Circle, Copy, GripVertical, Plus, RotateCcw, Star, X, MoreHorizontal, CalendarRange } from 'lucide-react';
import { AppSettings, CategoryItem, Preset, Schedule, TitleBlock } from '../../types';
import { formatKoreanDate } from '../../utils/dateHelpers';
import { compareSchedules, canReorderSchedules } from '../../utils/scheduleOrder';
import { getPresetBlocks } from '../../utils/phrases';
import { useMobileSheet, useRevealSheetPanel } from '../../hooks/useMobileSheet';
import { useScheduleDialog } from '../../hooks/useScheduleDialog';
import { useDragOrder } from '../../hooks/useDragOrder';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import { DiscardPrompt } from '../common/DiscardPrompt';
import { TimeField } from '../common/TimeField';
import { CategoryActions, CategoryManager } from './CategoryManager';
import { TitleBlockEditor } from '../common/TitleBlockEditor';
import { InlinePresetPicker } from '../common/InlinePresetPicker';
import { PhraseManager } from './PhraseManageModal';

type QuickDraft = { title: string; blocks?: TitleBlock[]; isImportant: boolean; category: string; timed: boolean; startTime: string; endTime: string; memo: string };
const emptyDraft = (): QuickDraft => ({ title: '', isImportant: false, category: '', timed: false, startTime: '09:00', endTime: '10:00', memo: '' });
const button = 'min-h-11 min-w-11 px-2 rounded-lg text-xs text-[#85777D] hover:bg-[#F6E8ED] disabled:opacity-40';
interface Props extends CategoryActions {
  registrationNotice?:RegistrationNoticeData|null;
  onDismissRegistration?:()=>void;
  onUndoRegistration?:()=>Promise<void>;
  open: boolean;
  date: string;
  presets: Preset[];
  categorySchedules: Schedule[];
  settings: AppSettings;
  onClose: () => void;
  onSelectDate: (date: string) => void;
  onSave: (schedule: Schedule) => Promise<void>;
  onEdit: (schedule: Schedule) => void;
  onToggle: (id: string) => Promise<void>;
  onMove: (schedule: Schedule) => void;
  onCopyDate: () => void;
  onDetails: (draft: Partial<Schedule>, saved: () => void, batch?: boolean) => void;
  onReorder: (schedules: Schedule[]) => Promise<void>;
  onSettings: (settings: AppSettings) => Promise<void>;
  onSavePreset: (preset: Preset) => Promise<void>;
  onDeletePreset: (id: string) => Promise<void>;
  onReorderPresets: (ids: string[]) => Promise<void>;
  onUsePreset: (id: string) => Promise<void>;
  undoLabel?: string;
  onUndo?: () => Promise<void>;
}

function ScheduleRows({ items, grouped, categories, onEdit, onMove, onToggle, onReorder, onError }: {
  items: Schedule[]; grouped: boolean; categories: CategoryItem[];
  onEdit: Props['onEdit']; onMove: Props['onMove']; onToggle: Props['onToggle']; onReorder: Props['onReorder']; onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); onError('');
    try { await action(); } catch { onError('변경사항을 저장하지 못했습니다. 기존 순서를 유지합니다.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const drag = useDragOrder(items.map(s => s.id), ids => {
    const next = ids.map(id => items.find(s => s.id === id)!);
    const moved = items.filter((s, i) => s.id !== next[i].id);
    if (!moved.length) return;
    if (moved.some(s => !canReorderSchedules(moved[0], s, grouped))) {
      onError('같은 시작 시간끼리 또는 시간 없는 일정끼리 이동할 수 있습니다. 시간 변경은 일정 수정에서 해주세요.'); return;
    }
    void run(() => onReorder(next.map((s, sortOrder) => ({ ...s, sortOrder }))));
  }, !busy, 300);
  return <div ref={drag.rootRef} aria-busy={busy}>
    {items.map(s => {
      const cat = categories.find(c => c.id === s.category);
      return <div key={s.id} data-day-schedule={s.id} {...drag.itemProps(s.id)} className="flex items-center gap-1 border-b border-[#F0E7EB] py-1.5">
        <button type="button" {...drag.handleProps(s.id)} disabled={busy} aria-label={s.title + ' 일정 순서 이동'} className={button + ' cursor-grab px-0 min-w-8'}><GripVertical className="w-4 h-4 mx-auto" /></button>
        <button type="button" disabled={busy} aria-label={s.completed ? '일정 완료 해제' : '일정 완료'} aria-pressed={s.completed} onClick={() => void run(() => onToggle(s.id))} className={button + ' px-0 min-w-8'}>{s.completed ? <CheckCircle2 className="w-4 h-4 mx-auto text-[#AD728B]" /> : <Circle className="w-4 h-4 mx-auto text-[#BAAFB4]" />}</button>
        <button type="button" onClick={() => onEdit(s)} className="min-h-11 flex-1 min-w-0 text-left py-1" aria-label={s.title + ' 수정'}>
          <span className="flex items-start gap-1.5"><span aria-label={cat?.name || '미분류'} className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: cat?.color || '#A69BA1' }} />{s.isImportant && <Star aria-label="중요 일정" className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#AD728B] fill-current" />}<span data-schedule-title className={`text-sm break-words min-w-0 ${s.isImportant ? 'font-bold' : 'font-normal'} ${s.completed ? 'line-through text-[#85777D]' : ''}`}>{s.title}</span></span>
          <span className="block ml-3.5 text-[11px] text-[#85777D] mt-1">{s.startTime ? s.startTime + (s.endTime ? ' ~ ' + s.endTime : '') : '시간 없음'}{!grouped && ' · ' + (cat?.name || '미분류')}</span>
        </button>
        <button type="button" disabled={busy} aria-label={s.title + ' 이동/복사'} onClick={() => onMove(s)} className={button}><ArrowRight className="w-4 h-4" /></button>
      </div>;
    })}
  </div>;
}

export function DayScheduleSheet(props: Props) {
  const { open, date, schedules, categories, presets, settings, onClose } = props;
  const root = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), dropArea = useRef<HTMLDivElement>(null);
  const mobileSheet=useMobileSheet<HTMLElement>(open);
  const [drafts, setDrafts] = useState<Record<string, QuickDraft>>({});
  const draft = drafts[date] || emptyDraft();
  const update = (patch: Partial<QuickDraft>) => setDrafts(all => ({ ...all, [date]: { ...(all[date] || emptyDraft()), ...patch } }));
  const [expanded, setExpanded] = useState(false);
  const [dateMenuOpen,setDateMenuOpen]=useState(false);
  const dateMenuAnchor=useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = useState<'presets' | 'presetManage' | 'categories' | 'categoryManage' | 'options' | null>(null);
  const categoryReturn = useRef<'options' | null>(null);
  const [panelDirty, setPanelDirty] = useState(false), [panelBusy, setPanelBusy] = useState(false);
  useRevealSheetPanel(open && panel==='presets',root,mobileSheet.expand);
  const [undoBusy, setUndoBusy] = useState(false);
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [notice, setNotice] = useState('');
  const [presetApplyMode,setPresetApplyMode] = useState<'replace'|'append'>('append');
  const [oldTitle, setOldTitle] = useState<{ text: string; blocks?: TitleBlock[] } | null>(null), [dropOver, setDropOver] = useState(false);
  const savingRef = useRef(false), composing = useRef(false), draftId = useRef(crypto.randomUUID());
  const guard = useDiscardGuard(panelDirty, panelBusy || saving);
  const changePanel = (next: typeof panel) => { setPanel(next); setPanelDirty(false); setPanelBusy(false); setError(''); };
  const back = () => { if(dateMenuOpen){setDateMenuOpen(false);requestAnimationFrame(()=>dateMenuAnchor.current?.focus({preventScroll:true}));return true;} if (guard.confirming) { guard.cancel(); return false; } return guard.request(() => changePanel(null)); };
  const close = () => { if (guard.confirming) { guard.cancel(); return false; } if (savingRef.current || panelBusy || undoBusy) return false; return guard.request(() => { onClose(); requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-calendar-date="' + date + '"]')?.focus({ preventScroll: true })); }); };
  useScheduleDialog(open, Boolean(panel)||dateMenuOpen, root, close, back);
  useEffect(() => { if (!open) {setDateMenuOpen(false);changePanel(null);return;} if (open) { setDateMenuOpen(false);setPresetApplyMode('append'); setExpanded(Boolean(draft.title)); changePanel(null); setNotice(''); setOldTitle(null); guard.cancel(); requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('header button')?.focus({ preventScroll: true })); } }, [open, date]);
  const focusTitle = () => requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
  const apply = (preset: Preset) => {
    if (draft.title !== preset.text) setOldTitle({ text: draft.title, blocks: draft.blocks });
    const parts=getPresetBlocks(preset), current=draft.blocks?.map(b=>b.text).join(' ')===draft.title?draft.blocks:draft.title.trim()?[{id:crypto.randomUUID(),text:draft.title}]:[];
    const next=presetApplyMode==='append'?[...(current || []),...parts]:parts;
    update({ title: next.map(b=>b.text).join(' '), blocks: next }); setExpanded(true); setPresetApplyMode('append'); setNotice('프리셋을 추가했습니다. 계속 선택하거나 X를 눌러 입력으로 돌아가세요.');
    void props.onUsePreset(preset.id).catch(() => setError('프리셋 사용 내역을 저장하지 못했습니다. 제목은 유지됩니다.'));
  };
  const touch = useRef<{ preset: Preset; x: number; y: number; since: number; moving: boolean } | null>(null);
  const presetDrag = (preset: Preset) => ({
    draggable: true,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onDragStart: (e: React.DragEvent) => { if (touch.current) { e.preventDefault(); return; } e.dataTransfer.setData('application/x-minially-preset', preset.id); e.dataTransfer.effectAllowed = 'copy'; },
    onDragEnd: () => setDropOver(false),
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => { if (e.pointerType === 'mouse') return; touch.current = { preset, x: e.clientX, y: e.clientY, since: Date.now(), moving: false }; e.currentTarget.setPointerCapture(e.pointerId); },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => { const start = touch.current; if (!start || Date.now() - start.since < 300) return; if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return; start.moving = true; const rect = dropArea.current?.getBoundingClientRect(); setDropOver(Boolean(rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom)); },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => { const start = touch.current; if (start?.moving && dropOver) { e.preventDefault(); apply(start.preset); } touch.current = null; setDropOver(false); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); },
    onPointerCancel: () => { touch.current = null; setDropOver(false); },
  });
  const save = async () => {
    if (savingRef.current || composing.current || !draft.title.trim()) return;
    if (draft.timed && draft.endTime <= draft.startTime) { setError('종료 시간을 시작 시간보다 늦게 선택하세요.'); return; }
    savingRef.current = true; setSaving(true); setError('');
    try {
      await props.onSave({ id: draftId.current, title: draft.title.trim(), date, category: categories.some(c => c.id === draft.category) ? draft.category : '', startTime: draft.timed ? draft.startTime : '', endTime: draft.timed ? draft.endTime : '', memo: draft.memo, isImportant: draft.isImportant, completed: false, sortOrder: Date.now(), ...(draft.blocks && draft.blocks.map(b => b.text).join(' ') === draft.title ? { titleBlocks: draft.blocks } : {}) });
      update({ title: '', blocks: undefined, isImportant: false, memo: '' }); draftId.current = crypto.randomUUID(); setOldTitle(null); setNotice('');
    } catch { setError('일정을 저장하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.'); }
    finally { savingRef.current = false; setSaving(false); focusTitle(); }
  };
  if (!open) return null;
  const items = schedules.filter(s => s.date === date).sort(compareSchedules);
  const grouped = (settings.dayScheduleView || 'category') === 'category';
  const groups = [...categories.map(c => ({ id: c.id, name: c.name, color: c.color, items: items.filter(s => s.category === c.id) })), { id: '', name: '미분류', color: '#A69BA1', items: items.filter(s => !categories.some(c => c.id === s.category)) }].filter(g => g.items.length);
  const shiftDate = (delta: number) => { const day = new Date(date + 'T12:00:00'); day.setDate(day.getDate() + delta); props.onSelectDate(`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`); };
  return <div ref={root} data-day-overlay role="dialog" aria-modal="true" aria-label="날짜별 일정" className="app-modal day-overlay fixed inset-x-0 top-0 h-[var(--modal-height,100dvh)] z-50 bg-[rgba(45,35,40,0.25)] flex items-end sm:items-center justify-center sm:p-4" onClick={e => {
    if (e.target !== e.currentTarget || saving || panelBusy || undoBusy) return;
    e.preventDefault(); e.stopPropagation(); close();
  }}>
    <section ref={mobileSheet.surfaceRef} style={mobileSheet.style} className="day-sheet w-full sm:max-w-xl bg-white rounded-2xl sm:shadow-xl border-t sm:border border-[#F0E7EB] flex flex-col overflow-hidden safe-bottom">
      <button {...mobileSheet.handleProps} className="mobile-sheet-handle sm:hidden shrink-0 w-full flex items-center justify-center cursor-grab active:cursor-grabbing"><span className="w-10 h-1 rounded-full bg-[#E8D5DC]"/></button>
      <header className="px-3 py-1 flex items-center gap-1 shrink-0 border-b border-[#F0E7EB]">
        {panel ? <button type="button" className={button} onClick={back} aria-label="일정 목록으로"><ArrowLeft className="w-4 h-4" /></button> : <button type="button" className={button} disabled={saving || undoBusy} onClick={() => shiftDate(-1)} aria-label="이전 날짜"><ChevronLeft className="w-4 h-4" /></button>}
        <h2 className="text-xs sm:text-sm font-bold flex-1 min-w-0">{panel === 'presets' ? '프리셋' : panel === 'presetManage' ? '프리셋 관리' : panel === 'categoryManage' ? '카테고리 관리' : panel === 'categories' ? '카테고리 선택' : panel === 'options' ? '빠른 등록 옵션' : formatKoreanDate(date)}</h2>
        {!panel && <button type="button" className={button} disabled={saving || undoBusy} onClick={() => shiftDate(1)} aria-label="다음 날짜"><ChevronRight className="w-4 h-4" /></button>}
        {!panel&&<button ref={dateMenuAnchor} type="button" className={button} aria-label="날짜 작업" title="날짜 작업" aria-expanded={dateMenuOpen} disabled={saving||undoBusy} onClick={()=>setDateMenuOpen(value=>!value)}><MoreHorizontal className="w-5 h-5"/></button>}
        <button type="button" className={button} aria-label="날짜 팝업 닫기" onClick={close}><X className="w-5 h-5" /></button>
      </header>
      {props.registrationNotice&&<RegistrationNotice key={props.registrationNotice.id} notice={props.registrationNotice} onDismiss={props.onDismissRegistration} onUndo={props.onUndoRegistration} container={root.current}/>}
      {dateMenuOpen&&<CalendarDateMenu anchor={dateMenuAnchor.current} container={root.current} onClose={()=>setDateMenuOpen(false)}>
        <button type="button" className={button+' w-full flex items-center gap-2 text-left'} onClick={()=>{setDateMenuOpen(false);setExpanded(true);focusTitle();}}><Plus className="w-4 h-4"/>간편 등록</button>
        <button type="button" className={button+' w-full flex items-center gap-2 text-left'} onClick={()=>{setDateMenuOpen(false);props.onCopyDate();}}><Copy className="w-4 h-4"/>일정 전체 복사</button>
        <button type="button" className={button+' w-full flex items-center gap-2 text-left'} onClick={()=>{setDateMenuOpen(false);props.onDetails({title:draft.title,date,category:draft.category,isImportant:draft.isImportant,startTime:draft.timed?draft.startTime:'',endTime:draft.timed?draft.endTime:'',memo:draft.memo,titleBlocks:draft.blocks},()=>update({title:'',blocks:undefined,isImportant:false,memo:''}),true);}}><CalendarRange className="w-4 h-4"/>여러 날짜 등록</button>
      </CalendarDateMenu>}
      {guard.confirming && <DiscardPrompt onContinue={guard.cancel} onDiscard={guard.discard} />}
      {error && <p role="alert" className="px-4 py-1.5 text-xs text-[#C4476B] shrink-0">{error}</p>}
      {!panel && <div className="px-4 flex items-center gap-1 shrink-0 border-b border-[#F0E7EB]"><span className="text-xs text-[#85777D] flex-1">{items.length}개 일정</span>{(['category', 'list'] as const).map(view => <button key={view} type="button" aria-pressed={(settings.dayScheduleView || 'category') === view} onClick={() => void props.onSettings({ ...settings, dayScheduleView: view }).catch(() => setError('보기 방식을 저장하지 못했습니다.'))} className={button + ((settings.dayScheduleView || 'category') === view ? ' text-[#AD728B] bg-[#FFFAFB] font-semibold' : '')}>{view === 'category' ? '카테고리형' : '목록형'}</button>)}{props.undoLabel && <button type="button" disabled={undoBusy || saving} aria-label="실행 취소" title={props.undoLabel} className={button} onClick={async () => { if (undoBusy) return; setUndoBusy(true); try { await props.onUndo?.(); } finally { setUndoBusy(false); } }}><RotateCcw className="w-4 h-4" /></button>}</div>}
      <div data-day-scroll data-sheet-scroll className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3" data-schedule-panel={panel || undefined}>
        {!panel && (!items.length ? <p className="text-center py-8 text-xs text-[#85777D]">등록된 일정이 없습니다.</p> : grouped ? groups.map(group => <section key={group.id} aria-label={group.name}><h3 className="flex gap-2 items-center text-xs font-semibold pt-4 pb-1 px-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: group.color }} />{group.name}</h3><ScheduleRows items={group.items} grouped categories={categories} onEdit={props.onEdit} onMove={props.onMove} onToggle={props.onToggle} onReorder={props.onReorder} onError={setError} /></section>) : <ScheduleRows items={items} grouped={false} categories={categories} onEdit={props.onEdit} onMove={props.onMove} onToggle={props.onToggle} onReorder={props.onReorder} onError={setError} />)}
        {panel === 'presets' && <div className="pt-3 min-w-0"><InlinePresetPicker selectedBlocks={draft.blocks || []} options={<label className="text-xs flex items-center gap-2">적용 방식<select aria-label="프리셋 적용 방식" className="min-h-11 border rounded-lg bg-white px-2" value={presetApplyMode} onChange={e=>setPresetApplyMode(e.target.value as 'replace'|'append')}><option value="replace">제목 교체</option><option value="append">이어 붙이기</option></select></label>} presets={presets} presetGroups={settings.presetGroups || []} dragHandle={p=><button type="button" {...presetDrag(p)} style={{touchAction:'none'}} aria-label={p.text+' 입력창으로 드래그'} className={button+' cursor-grab'}><GripVertical className="w-4 h-4"/></button>} onAdd={(_,preset)=>apply(preset)} onManage={()=>changePanel('presetManage')} onClose={()=>{changePanel(null);focusTitle();}}/></div>}
        {panel === 'presetManage' && <div className="pt-3"><PhraseManager hideSearch presets={presets} presetGroups={settings.presetGroups || []} initialMode="manage" onSavePreset={props.onSavePreset} onDeletePreset={props.onDeletePreset} onReorderPresets={props.onReorderPresets} onDirtyChange={setPanelDirty} onBusyChange={setPanelBusy} /></div>}
        {panel === 'categoryManage' && <div className="pt-3"><CategoryManager categories={categories} schedules={props.categorySchedules} onSaveCategory={props.onSaveCategory} onDeleteCategory={async id => { await props.onDeleteCategory(id); if (draft.category === id) update({ category: '' }); }} onReorderCategories={props.onReorderCategories} onCreated={id => { update({ category: id }); changePanel(categoryReturn.current); }} onDirtyChange={setPanelDirty} onBusyChange={setPanelBusy} /></div>}
        {panel === 'categories' && <div className="pt-3 space-y-1"><button type="button" className={button + ' block w-full text-left'} onClick={() => { update({ category: '' }); changePanel(categoryReturn.current); }}>미분류 (선택 해제)</button><CategoryGrid categories={categories} value={draft.category} onChange={category=>{update({category});changePanel(categoryReturn.current);}}/><button type="button" className={button} onClick={() => changePanel('categoryManage')}>카테고리 추가·관리</button></div>}
        {panel === 'options' && <div className="pt-3 space-y-3"><p className="text-xs text-[#85777D]">{formatKoreanDate(date)} · 반복·여러 날짜 등록은 상세 등록에서 설정하세요.</p><label className="flex items-center gap-2 text-sm min-h-11"><input type="checkbox" checked={draft.timed} onChange={e => update({ timed: e.target.checked })} />시간 지정</label>{draft.timed && <div className="flex items-center gap-2"><TimeField label="시작 시간" value={draft.startTime} onChange={startTime => update({ startTime })} /><span>~</span><TimeField label="종료 시간" value={draft.endTime} onChange={endTime => update({ endTime })} /></div>}<button type="button" className={button + ' border border-[#F0E7EB] w-full text-left'} aria-label="카테고리 선택" onClick={() => {categoryReturn.current='options';changePanel('categories');}}>{categories.find(c => c.id === draft.category)?.name || '카테고리 선택하세요'}</button><textarea aria-label="빠른 등록 메모" placeholder="메모" className="w-full min-h-16 p-2 text-base border border-[#F0E7EB] rounded-xl" value={draft.memo} onChange={e => update({ memo: e.target.value })} /><button type="button" className={button} onClick={() => { props.onDetails({ title: draft.title, date, category: draft.category, isImportant: draft.isImportant, startTime: draft.timed ? draft.startTime : '', endTime: draft.timed ? draft.endTime : '', memo: draft.memo, titleBlocks: draft.blocks }, () => update({ title: '', blocks: undefined, isImportant: false, memo: '' })); }}>상세 등록 열기</button></div>}
      </div>
      {panel !== 'presetManage' && panel !== 'categoryManage' && panel !== 'categories' && <div ref={dropArea} data-preset-drop className={`shrink-0 border-t border-[#F0E7EB] px-4 py-2 bg-white ${dropOver ? 'outline-2 outline-dashed outline-[#BD7F98] bg-[#FFFAFB]' : ''}`} onDragOver={e => { if (e.dataTransfer.types.includes('application/x-minially-preset')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropOver(true); } }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropOver(false); }} onDrop={e => { const id = e.dataTransfer.getData('application/x-minially-preset'), preset = presets.find(p => p.id === id); if (!preset) return; e.preventDefault(); setDropOver(false); apply(preset); }}>
        {!expanded ? <button type="button" className="w-full min-h-11 bg-[#F6E8ED] rounded-xl text-sm font-semibold text-[#AD728B] flex items-center justify-center gap-1" onClick={() => { setExpanded(true); focusTitle(); }}><Plus className="w-4 h-4" />일정 추가</button> : <form onSubmit={e => { e.preventDefault(); void save(); }}>
          <div className="flex items-center gap-1"><input ref={input} aria-label="빠른 일정 제목" placeholder="제목 입력 후 Enter" enterKeyHint="send" autoComplete="off" readOnly={saving} value={draft.title} onChange={e => update({ title: e.target.value, blocks: undefined })} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={e => { if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229 || composing.current)) e.preventDefault(); }} className="flex-1 min-w-0 px-3 text-base border border-[#F0E7EB] rounded-xl bg-[#FFFAFB]" /><button type="button" className={button+' bg-[#F6E8ED] text-[#8F526C]'} disabled={saving} aria-expanded={panel==='presets'} onClick={()=>changePanel(panel==='presets'?null:'presets')}>프리셋</button><button type="submit" disabled={saving || !draft.title.trim()} className="min-h-11 px-3 rounded-xl bg-[#CF8FA8] text-white text-sm disabled:opacity-40">{saving ? '저장 중' : '등록'}</button></div>
          {draft.blocks?.length && draft.blocks.map(b=>b.text).join(' ')===draft.title ? <div className="mt-2 max-h-24 overflow-y-auto overscroll-contain" aria-label="빠른 등록 제목 블록" onKeyDown={e=>{if(e.target instanceof HTMLInputElement && e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();e.stopPropagation();}}}><TitleBlockEditor compact editable hideWordInput blocks={draft.blocks} word="" onWordChange={()=>{}} onChange={blocks=>{setOldTitle({text:draft.title,blocks:draft.blocks});update({title:blocks.map(b=>b.text).join(' '),blocks});}}/></div> : null}
          <div className="flex flex-wrap items-center gap-1"><button type="button" aria-label="빠른 등록 카테고리 선택" className={button+' flex items-center gap-1.5 max-w-full'} disabled={saving} onClick={()=>{categoryReturn.current=null;changePanel('categories');}}>{categories.some(c=>c.id===draft.category)&&<span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:categories.find(c=>c.id===draft.category)?.color}}/>}<span className="truncate">{categories.find(c=>c.id===draft.category)?.name || '카테고리 선택하세요'}</span></button><button type="button" className={button} aria-label="중요 일정" disabled={saving} aria-pressed={draft.isImportant} onClick={() => update({ isImportant: !draft.isImportant })}><Star className={'w-5 h-5 text-[#AD728B] ' + (draft.isImportant ? 'fill-current' : '')} /></button><button type="button" className={button} disabled={saving} onClick={() => changePanel('options')}>상세 옵션</button>{oldTitle !== null && <button type="button" className={button} onClick={() => { update({ title: oldTitle.text, blocks: oldTitle.blocks }); setOldTitle(null); focusTitle(); }}>이전 제목 복구</button>}</div>
          {notice && <p role="status" className="text-[11px] text-[#85777D] pb-1">{notice}</p>}
        </form>}
      </div>}
    </section>
  </div>;
}
