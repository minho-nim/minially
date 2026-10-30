import React, { useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { PresetGroupTabs } from '../common/PresetGroupTabs';
import { PresetGroupManager } from '../common/PresetGroupManager';
import { usePresetGroup } from '../../hooks/usePresetGroup';
import { Preset, PresetGroup, PhraseType, TitleBlock } from '../../types';
import { X, Star, Edit2, Trash2, ArrowUp, ArrowDown, Search, GripVertical, MoreHorizontal } from 'lucide-react';
import { getPresetBlocks, phraseOrder, PhraseSort, sortPresets } from '../../utils/phrases';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import { useDragOrder } from '../../hooks/useDragOrder';
import { TitleBlockEditor } from '../common/TitleBlockEditor';
import { DiscardPrompt } from '../common/DiscardPrompt';

type PhraseActions = {
  presets: Preset[];
  onSelectPhrase?: (text: string, phrase: Preset) => void;
  onSavePreset: (preset: Preset) => Promise<void> | void;
  onDeletePreset: (id: string) => Promise<void> | void;
  onReorderPresets: (ids: string[]) => Promise<void> | void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  initialBlocks?: TitleBlock[];
  existingTitle?: string;
  onApplyComposition?: (blocks: TitleBlock[]) => void;
  composePresets?: boolean;
  hideSearch?: boolean;
  presetGroups?: PresetGroup[];
  initialType?: PhraseType | 'all';
  initialMode?: 'select' | 'manage';
};
const button = 'min-h-11 min-w-11 px-2 py-1 text-xs rounded-lg text-[#85777D] hover:bg-[#F6E8ED] disabled:opacity-40 cursor-pointer';
const primary = `${button} bg-[#CF8FA8] text-white hover:bg-[#BD7F98]`;
const input = 'w-full min-w-0 min-h-11 px-3 py-2 text-base sm:text-sm border border-[#F0E7EB] rounded-lg bg-white text-[#3E3438] focus:outline-none focus:border-[#CF8FA8]';
export function PhraseManager({ presets, onSelectPhrase, onSavePreset, onDeletePreset, onReorderPresets, onDirtyChange, onBusyChange, initialBlocks = [], existingTitle = '', onApplyComposition, composePresets = false, hideSearch = false, presetGroups = [], initialType = 'title', initialMode = 'manage' }: PhraseActions) {
  const [activeGroupId, setActiveGroup, hasUnclassified] = usePresetGroup(presetGroups, presets);
  const [groupManaging,setGroupManaging] = useState(false),[groupDirty,setGroupDirty] = useState(false),[groupBusy,setGroupBusy] = useState(false),[moving,setMoving] = useState<string|null>(null),[moreId,setMoreId] = useState<string|null>(null);
  const [filter, setFilter] = useState(initialType);
  const [blocks, setBlocks] = useState<TitleBlock[]>(initialBlocks);
  const [word, setWord] = useState('');
  const includeTitle = blocks.some(b => b.id === 'current-title');
  const compositionEnabled = Boolean(onApplyComposition) || composePresets;
  const compositionId = useRef<string | null>(null);
  const [editBlocks, setEditBlocks] = useState<TitleBlock[]>([]), [editWord, setEditWord] = useState('');
  const initialComposition = useRef(JSON.stringify(initialBlocks.map(b => [b.text, b.presetId])));
  const compositionDirty = compositionEnabled && (JSON.stringify(blocks.map(b => [b.text, b.presetId])) !== initialComposition.current || !!word);
  const [sort, setSort] = useState<PhraseSort>('manual');
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [managing, setManaging] = useState(initialMode === 'manage');
  const [newText, setNewText] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const busy = useRef(false), draftId = useRef<string | null>(null);
  const newInput = useRef<HTMLInputElement>(null), newInputId = useId();
  const original = presets.find(p => p.id === editingId);
  const bundleEditing = Boolean(original?.blocks?.length);
  const editParts = editWord.trim() ? [...editBlocks, { id: 'new-edit-word', text: editWord.trim() }] : editBlocks;
  const editedText = bundleEditing ? editParts.map(b => b.text.trim()).join(' ') : editText.trim();
  const bundleDirty = bundleEditing && (JSON.stringify(editBlocks.map(b => b.text)) !== JSON.stringify(original?.blocks?.map(b => b.text)) || !!editWord);
  const dirty = adding ? Boolean(newText || favorite) : !!editingId && (editText !== original?.text || bundleDirty);
  const guard = useDiscardGuard(dirty || groupDirty, pending || groupBusy);
  useLayoutEffect(() => { onDirtyChange?.(dirty || compositionDirty || groupDirty); }, [dirty, compositionDirty, groupDirty, onDirtyChange]);
  useLayoutEffect(() => { onBusyChange?.(pending || groupBusy); }, [pending, groupBusy, onBusyChange]);
  const resetForm = () => { setAdding(false); setNewText(''); setFavorite(false); setEditingId(null); setEditBlocks([]); setEditWord(''); setDeletingId(null); draftId.current = null; setError(''); };
  const navigate = (action: () => void) => guard.request(() => { resetForm(); action(); });
  const run = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(''); setMessage('');
    try { await action(); }
    catch { setError('프리셋을 저장하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.'); }
    finally { busy.current = false; setPending(false); }
  };
  const ordered = sortPresets(presets, sort);
  if (sort === 'manual') ordered.sort((a, b) => phraseOrder(a) - phraseOrder(b) || a.id.localeCompare(b.id));
  const search = query.trim().toLocaleLowerCase();
  const matchesGroup = (p: Preset) => (presetGroups.some(g => g.id === p.groupId) ? p.groupId : '') === activeGroupId;
  const matchesType = (p: Preset) => matchesGroup(p) && (compositionEnabled ? (p.type || 'title') === 'title' : filter === 'all' || (p.type || 'title') === filter);
  const featuredIds = new Set(!managing && !search ? [...ordered.filter(p => p.isFavorite && matchesType(p)), ...sortPresets(presets, 'recent').filter(p => !p.isFavorite && p.lastUsedAt && matchesType(p)).slice(0, 3)].map(p => p.id) : []);
  const visible = ordered.filter(p => matchesType(p) && (!favoritesOnly || p.isFavorite) && p.text.toLocaleLowerCase().includes(search) && !featuredIds.has(p.id));
  const select = (p: Preset) => navigate(() => {
    if (compositionEnabled) setBlocks(current => [...current, ...getPresetBlocks(p)]);
    else onSelectPhrase?.(p.text, p);
  });
  const drag = useDragOrder(ordered.map(p => p.id), ids => void run(async () => { await onReorderPresets(ids); }), managing && sort === 'manual' && !search && !favoritesOnly && !pending);
  const composition = word.trim() ? [...blocks, { id: 'pending-word', text: word.trim() }] : blocks;
  const readyBlocks = () => composition.map(b => b.id === 'pending-word' ? { ...b, id: crypto.randomUUID() } : b);
  const saveComposition = () => {
    if (!composition.length || busy.current) return;
    const parts = readyBlocks().map(b => ({ ...b, text: b.text.trim() }));
    if (parts.some(b => !b.text)) { setError('빈 블록에 내용을 입력하거나 제거해 주세요.'); return; }
    const text = parts.map(b => b.text).join(' ');
    if (presets.some(p => (p.type || 'title') === 'title' && p.text.trim() === text && (p.groupId || '') === activeGroupId)) { setError('이미 저장된 프리셋 묶음입니다.'); return; }
    void run(async () => {
      compositionId.current ??= crypto.randomUUID(); const now = Date.now();
      await onSavePreset({ id: compositionId.current, text, blocks: parts, groupId: activeGroupId || undefined, type: 'title', isFavorite: false, usageCount: 0, createdAt: now, updatedAt: now, sortOrder: Math.max(0, ...presets.map(phraseOrder)) + 1 });
      compositionId.current = null; setBlocks([]); setWord(''); initialComposition.current = '[]'; setQuery(''); setMessage('블록 묶음을 프리셋에 등록했습니다.');
    });
  };
  const duplicate = (text: string, type: PhraseType, id?: string) => presets.some(p => p.id !== id && (p.type || 'title') === type && p.text.trim() === text.trim() && (p.groupId || '') === (original?.groupId || (activeGroupId === 'all' ? '' : activeGroupId)));
  return <fieldset disabled={pending || groupBusy} aria-busy={pending || groupBusy} className="min-w-0 flex flex-col gap-3">
    {guard.confirming && <DiscardPrompt onContinue={guard.cancel} onDiscard={guard.discard} />}
    {!groupManaging && <PresetGroupTabs groups={presetGroups} value={activeGroupId} unclassified={hasUnclassified} onChange={id=>navigate(()=>{setActiveGroup(id);setGroupDirty(false);setMoving(null);})}/>}
    <div className="flex items-center justify-between gap-2"><button type="button" className={button+' self-start border border-[#E9CDD8] bg-[#FFFAFB] text-[#8F526C]'} onClick={()=>navigate(()=>{setGroupManaging(v=>!v);setGroupDirty(false);})}>{groupManaging?'프리셋 목록으로':'프리셋 그룹 관리'}</button></div>
    {groupManaging ? <PresetGroupManager groups={presetGroups} presets={presets} onSelect={setActiveGroup} onCreated={()=>{setGroupManaging(false);setGroupDirty(false);setGroupBusy(false);}} onDirtyChange={setGroupDirty} onBusyChange={setGroupBusy}/> : <>

    {!hideSearch && !adding && !editingId && <div className="relative"><Search className="absolute left-3 top-3.5 w-4 h-4 text-[#85777D]" /><input type="search" aria-label="프리셋 검색" placeholder="프리셋 검색" value={query} onChange={e => setQuery(e.target.value)} className={`${input} pl-9 pr-14`} />{query && <button type="button" aria-label="검색어 지우기" className={`${button} absolute right-0 top-0`} onClick={() => setQuery('')}><X className="w-4 h-4" /></button>}</div>}
    {compositionEnabled && !adding && !editingId && <div className="space-y-2">
      {existingTitle.trim() && !initialBlocks.length && <label className="flex items-center gap-2 text-xs min-h-11"><input type="checkbox" checked={includeTitle} onChange={e => { if (e.target.checked) setBlocks(bs => [{ id: 'current-title', text: existingTitle.trim() }, ...bs]); else setBlocks(bs => bs.filter(b => b.id !== 'current-title')); }} />현재 제목 포함</label>}
      <TitleBlockEditor blocks={blocks} onChange={setBlocks} word={word} onWordChange={setWord} editable={composePresets} purpose={composePresets ? 'preset' : 'title'} />
    </div>}
    {managing && ordered.some(matchesType) && !adding && !editingId && <details className="text-xs"><summary className="min-h-11 py-3 cursor-pointer text-[#85777D]">보기 설정 · 즐겨찾기 / 정렬</summary><div className="flex flex-wrap gap-1 items-center">
      {!compositionEnabled && presets.some(p => p.type === 'memo') && (['title', 'memo', 'all'] as const).map(type => <button key={type} type="button" className={filter === type ? primary : button} aria-pressed={filter === type} onClick={() => navigate(() => setFilter(type))}>{type === 'title' ? '일정 제목' : type === 'memo' ? '기존 메모' : '전체'}</button>)}
      <button type="button" className={favoritesOnly ? primary : button} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(v => !v)}>즐겨찾기만</button>
      <select aria-label="프리셋 정렬" value={sort} onChange={e => setSort(e.target.value as PhraseSort)} className="min-h-11 bg-white text-xs border border-[#F0E7EB] rounded-lg px-2"><option value="manual">지정 순서</option><option value="recent">최근 사용순</option><option value="usage">자주 사용순</option></select>
    </div></details>}
    {error && <p role="alert" className="text-xs text-[#C4476B]">{error}</p>}{message && <p role="status" className="text-xs text-[#85777D]">{message}</p>}
    {!managing && !search && <div className="space-y-3">
      {(['즐겨찾기', '최근 사용'] as const).map(section => {
        const items = section === '즐겨찾기' ? ordered.filter(p => p.isFavorite && matchesType(p)) : sortPresets(presets, 'recent').filter(p => !p.isFavorite && !!p.lastUsedAt && matchesType(p)).slice(0, 3);
        return items.length > 0 && <section key={section} aria-label={section}><h4 className="text-xs font-semibold text-[#85777D]">{section}</h4>{items.map(p => <button key={p.id} type="button" className="w-full min-h-11 py-2 text-left text-sm whitespace-normal break-words border-b border-[#F0E7EB]" onClick={() => select(p)}>{p.text}</button>)}</section>;
      })}
    </div>}
    {adding && <form className="space-y-2 border-t border-[#F0E7EB] pt-3" onSubmit={e => { e.preventDefault(); const text = newText.trim(), type = initialType === 'memo' ? 'memo' : 'title'; if (!text) return; if (duplicate(text, type)) { setError('이미 저장된 프리셋입니다.'); return; } void run(async () => { const now = Date.now(); draftId.current ??= crypto.randomUUID(); await onSavePreset({ id: draftId.current, type, text, groupId: activeGroupId === 'all' ? undefined : activeGroupId || undefined, isFavorite: favorite, usageCount: 0, lastUsedAt: 0, createdAt: now, updatedAt: now, sortOrder: Math.max(0, ...presets.map(phraseOrder)) + 1 }); resetForm(); setQuery(''); setFavoritesOnly(false); setFilter(type); setMessage('프리셋을 저장했습니다.'); }); }}>
      <label htmlFor={newInputId} className="text-xs font-semibold">새 프리셋</label><input id={newInputId} ref={newInput} className={input} placeholder="프리셋 내용을 입력하세요" required value={newText} onChange={e => setNewText(e.target.value)} />
      <div className="flex items-center gap-2"><label className="flex items-center gap-1 text-xs min-h-11"><input type="checkbox" checked={favorite} onChange={e => setFavorite(e.target.checked)} />즐겨찾기</label><button type="submit" className={`${primary} ml-auto`} disabled={!newText.trim()}>프리셋 저장</button><button type="button" className={button} onClick={() => navigate(() => {})}>취소</button></div>
    </form>}
    {!adding && <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold min-w-0 truncate">{presetGroups.find(g=>g.id===activeGroupId)?.name || '미분류'} <span className="text-xs font-normal text-[#85777D]">{visible.length}개</span></h4>{!editingId && <button type="button" className={primary} onClick={()=>navigate(()=>{setAdding(true);requestAnimationFrame(()=>newInput.current?.focus());})}>새 프리셋 추가</button>}</div>}
    {!adding && <>
    <div ref={drag.rootRef}><ul aria-label="프리셋 목록" className="divide-y divide-[#F0E7EB] max-h-[min(40dvh,360px)] overflow-y-auto overscroll-contain min-h-16">
      {!visible.length && <li className="py-4 text-center text-xs text-[#85777D]">{search || favoritesOnly ? '조건에 맞는 프리셋이 없습니다.' : '저장된 프리셋이 없습니다. 새 프리셋을 추가해 보세요.'}</li>}
      {visible.filter(p=>!editingId || p.id===editingId).map((phrase, index) => <li key={phrase.id} data-phrase-id={phrase.id} className="py-2" {...drag.itemProps(phrase.id)}>
        {editingId === phrase.id ? <form className="space-y-2" onSubmit={e => { e.preventDefault(); if (!editedText || (bundleEditing && editParts.some(b => !b.text.trim()))) { setError('빈 블록에 내용을 입력하거나 제거해 주세요.'); return; } if (duplicate(editedText, phrase.type || 'title', phrase.id)) { setError('이미 저장된 프리셋입니다.'); return; } void run(async () => { await onSavePreset({ ...phrase, text: editedText, ...(bundleEditing ? { blocks: editParts.map(b => ({ ...b, id: b.id === 'new-edit-word' ? crypto.randomUUID() : b.id, text: b.text.trim() })) } : {}) }); setEditingId(null); setMessage('변경사항을 저장했습니다.'); }); }}>
          <input aria-label="프리셋 수정 내용" className={input} autoFocus required value={editText} onChange={e => setEditText(e.target.value)} hidden={bundleEditing} />{bundleEditing && <TitleBlockEditor blocks={editBlocks} onChange={setEditBlocks} word={editWord} onWordChange={setEditWord} editable purpose="preset" />}
          <button type="submit" className={primary} disabled={!editedText || (!bundleDirty && editedText === phrase.text)}>변경사항 저장</button><button type="button" className={button} onClick={() => navigate(() => {})}>취소</button>
        </form> : <>
          <div className="flex items-center gap-1 min-w-0">
            {managing && <button type="button" {...drag.handleProps(phrase.id)} disabled={sort !== 'manual' || !!search || favoritesOnly} aria-label={phrase.text + ' 프리셋 위치 이동'} className="min-w-11 px-1 cursor-grab active:cursor-grabbing"><GripVertical className="w-4 h-4 text-[#AD728B]" /></button>}
            {managing && <button type="button" className={`${button} shrink-0`} aria-label={phrase.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 등록'} aria-pressed={phrase.isFavorite} onClick={() => void run(async () => { await onSavePreset({ ...phrase, isFavorite: !phrase.isFavorite }); })}><Star className={`w-4 h-4 ${phrase.isFavorite ? 'text-[#CF8FA8] fill-[#CF8FA8]' : ''}`} /></button>}
            {onSelectPhrase || compositionEnabled ? <button type="button" title={phrase.text} className="flex-1 min-w-0 min-h-11 text-left text-sm whitespace-normal break-words" onClick={() => select(phrase)}>{phrase.text}</button> : <span className="flex-1 min-w-0 text-sm break-words">{phrase.text}</span>}
            {phrase.blocks && phrase.blocks.length > 1 && <span className="text-[10px] text-[#85777D] shrink-0">묶음 {phrase.blocks.length}블록</span>}
            {managing && <><button type="button" className={`${button} shrink-0`} aria-label="프리셋 수정" onClick={() => navigate(() => { setEditingId(phrase.id); setEditText(phrase.text); setEditBlocks(getPresetBlocks(phrase)); setEditWord(''); })}>수정</button><button type="button" className={button+' shrink-0'} aria-label="프리셋 추가 작업" aria-expanded={moreId===phrase.id} onClick={()=>setMoreId(moreId===phrase.id?null:phrase.id)}><MoreHorizontal className="w-4 h-4"/></button></>}
          </div>
          {managing && moreId===phrase.id && <div className="flex items-center justify-end gap-1"><button type="button" className={`${button} shrink-0`} aria-label="프리셋 삭제" onClick={() => setDeletingId(phrase.id)}>삭제</button><button type="button" className={button+' mr-auto'} onClick={()=>setMoving(moving===phrase.id?null:phrase.id)}>그룹 이동</button>{([-1, 1] as const).map(direction => {
            const target = visible[index + direction];
            return <button key={direction} type="button" aria-label={direction < 0 ? '위로 이동' : '아래로 이동'} className={button} disabled={sort !== 'manual' || !!search || !target} onClick={() => void run(async () => { const ids = ordered.map(p => p.id), a = ids.indexOf(phrase.id), b = ids.indexOf(target.id); [ids[a], ids[b]] = [ids[b], ids[a]]; await onReorderPresets(ids); })}>{direction < 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}</button>;
          })}</div>}
          {moving===phrase.id&&<label className="flex items-center gap-2 text-xs">대상 그룹<select aria-label={phrase.text+' 이동할 그룹'} value={phrase.groupId||''} className="min-h-11 min-w-0 flex-1 border rounded-lg bg-white px-2" onChange={e=>{const id=e.target.value;void run(async()=>{await onSavePreset({...phrase,groupId:id||undefined});setMoving(null);setMoreId(null);});}}><option value="">미분류</option>{presetGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
          {deletingId === phrase.id && <div role="group" aria-label="프리셋 삭제 확인" className="text-xs p-2 bg-[#FFFAFB] rounded-lg"><p>이 프리셋을 삭제할까요? 기존 일정 제목은 유지됩니다.</p><button type="button" className={primary} onClick={() => void run(async () => { await onDeletePreset(phrase.id); setDeletingId(null); setMessage('프리셋을 삭제했습니다.'); })}>삭제</button><button type="button" className={button} onClick={() => setDeletingId(null)}>취소</button></div>}
        </>}
      </li>)}
    </ul></div></>}
    {!adding && (onSelectPhrase || compositionEnabled) && <button type="button" className={button} onClick={()=>navigate(()=>setManaging(v=>!v))}>{managing?'뒤로':'프리셋 관리'}</button>}
    {compositionEnabled && !adding && !editingId && <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#F0E7EB] pt-3 pb-1 bg-white">
      {onApplyComposition && <button type="button" disabled={!composition.length} className={primary} onClick={() => onApplyComposition(readyBlocks())}>제목 적용</button>}
      {composePresets && <button type="button" disabled={!composition.length || pending} className={primary} onClick={saveComposition}>프리셋 등록</button>}
    </div>}
    </>}
  </fieldset>;
}
