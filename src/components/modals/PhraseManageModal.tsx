import React, { useEffect, useId, useRef, useState } from 'react';
import { Preset, PhraseType } from '../../types';
import { X, Star, Edit2, Trash2, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { phraseOrder, PhraseSort, sortPresets } from '../../utils/phrases';

type PhraseActions = {
  presets: Preset[];
  onSelectPhrase?: (text: string, phrase: Preset) => void;
  onSavePreset: (preset: Preset) => Promise<void> | void;
  onDeletePreset: (id: string) => Promise<void> | void;
  onReorderPresets: (ids: string[]) => Promise<void> | void;
  initialType?: PhraseType | 'all';
  initialMode?: 'select' | 'manage';
};

const button = 'min-h-9 min-w-9 px-2 py-1 text-xs rounded-lg text-[#85777D] hover:bg-[#F6E8ED] disabled:opacity-40 cursor-pointer';
const primary = `${button} bg-[#CF8FA8] text-white hover:bg-[#BD7F98]`;
const input = 'w-full min-w-0 px-3 py-2 text-base sm:text-sm border border-[#F0E7EB] rounded-lg bg-white text-[#3E3438] focus:outline-none focus:border-[#CF8FA8]';

export function PhraseManager({ presets, onSelectPhrase, onSavePreset, onDeletePreset, onReorderPresets, initialType = 'title', initialMode = 'manage' }: PhraseActions) {
  const [filter, setFilter] = useState(initialType);
  const [sort, setSort] = useState<PhraseSort>('manual');
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [managing, setManaging] = useState(initialMode === 'manage');
  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState<PhraseType>(initialType === 'memo' ? 'memo' : 'title');
  const [favorite, setFavorite] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const draftId = useRef<string | null>(null);
  const newInputId = useId();

  useEffect(() => {
    setFilter(initialType);
    setNewType(initialType === 'memo' ? 'memo' : 'title');
    setManaging(initialMode === 'manage');
  }, [initialType, initialMode]);

  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try { await action(); }
    catch { setError('문구를 저장하거나 불러오지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.'); }
    finally { busy.current = false; setPending(false); }
  }

  const ordered = sortPresets(presets, sort);
  const search = query.trim().toLocaleLowerCase();
  const visible = ordered.filter(p =>
    (filter === 'all' || (p.type || 'title') === filter) &&
    (!favoritesOnly || p.isFavorite) && p.text.toLocaleLowerCase().includes(search)
  );

  const select = (phrase: Preset) => onSelectPhrase?.(phrase.text, phrase);

  return <fieldset disabled={pending} aria-busy={pending} className="min-w-0 flex flex-col gap-3">
    <div className="relative">
      <Search className="absolute left-3 top-3 w-4 h-4 text-[#85777D]" />
      <input type="search" aria-label="문구 검색" placeholder="문구 검색" value={query} onChange={e => setQuery(e.target.value)} className={`${input} pl-9 pr-14`} />
      {query && <button type="button" aria-label="검색 지우기" className={`${button} absolute right-1 top-0.5`} onClick={() => setQuery('')}><X className="w-4 h-4" /></button>}
    </div>
    <div className="flex flex-wrap items-center gap-1">
      {(['all', 'title', 'memo'] as const).map(type => <button type="button" key={type} aria-pressed={filter === type} onClick={() => {
        setFilter(type); if (type !== 'all') setNewType(type); setEditingId(null); setDeletingId(null);
      }} className={filter === type ? primary : button}>{type === 'all' ? '전체' : type === 'title' ? '일정 제목' : '메모'}</button>)}
      <button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(v => !v)} className={favoritesOnly ? primary : button}>즐겨찾기만</button>
    </div>
    <div className="flex items-center justify-between gap-2">
      <select aria-label="문구 정렬" value={sort} onChange={e => setSort(e.target.value as PhraseSort)} className="min-h-9 text-xs bg-white text-[#85777D] border border-[#F0E7EB] rounded-lg px-2">
        <option value="manual">지정 순서</option><option value="recent">최근 사용순</option><option value="usage">자주 사용순</option>
      </select>
      <button type="button" className={button} aria-pressed={managing} onClick={() => setManaging(v => !v)}><Edit2 className="inline w-3.5 h-3.5 mr-1" />{managing ? '편집 마침' : '문구 편집'}</button>
    </div>
    {error && <p role="alert" className="text-xs text-[#C4476B]">{error}</p>}
    {managing && <p className="text-[11px] text-[#85777D]">지정 순서에서 같은 즐겨찾기 그룹의 화살표로 순서를 바꿉니다. 검색 중에는 이동할 수 없습니다.</p>}
    <ul aria-label="저장된 문구 목록" className="divide-y divide-[#F0E7EB] max-h-[min(34dvh,320px)] overflow-y-auto overscroll-contain min-h-16">
      {visible.length === 0 && <li className="py-5 text-center text-xs text-[#85777D]">{search || favoritesOnly ? '조건에 맞는 문구가 없습니다.' : '등록된 문구가 없습니다. 아래에서 새 문구를 추가하세요.'}</li>}
      {visible.map((phrase, index) => <li key={phrase.id} data-phrase-id={phrase.id} className="py-2">
        {editingId === phrase.id ? <form onSubmit={e => {
          e.preventDefault();
          if (editText.trim()) void run(async () => { await onSavePreset({ ...phrase, text: editText.trim() }); setEditingId(null); });
        }} className="flex flex-wrap gap-2">
          <input aria-label="문구 수정 내용" className={input} autoFocus required value={editText} onChange={e => setEditText(e.target.value)} />
          <button type="submit" className={primary} disabled={!editText.trim()}>저장하기</button>
          <button type="button" className={button} onClick={() => setEditingId(null)}>취소</button>
        </form> : <>
          <div className="flex items-center gap-1 min-w-0">
            <button type="button" aria-label={phrase.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 등록'} aria-pressed={phrase.isFavorite} className={`${button} shrink-0`} onClick={() => void run(async () => { await onSavePreset({ ...phrase, isFavorite: !phrase.isFavorite }); })}><Star className={`w-4 h-4 ${phrase.isFavorite ? 'text-[#CF8FA8] fill-[#CF8FA8]' : ''}`} /></button>
            {onSelectPhrase ? <button type="button" title={phrase.text} className="text-left text-sm text-[#3E3438] flex-1 min-w-0 truncate min-h-10 hover:text-[#CF8FA8]" onClick={() => select(phrase)}>{phrase.text}</button> : <span title={phrase.text} className="text-sm text-[#3E3438] flex-1 min-w-0 truncate">{phrase.text}</span>}
            <button type="button" aria-label="문구 수정" className={`${button} shrink-0`} onClick={() => { setEditingId(phrase.id); setEditText(phrase.text); setDeletingId(null); }}><Edit2 className="w-3.5 h-3.5" /></button>
            <button type="button" aria-label="문구 삭제" className={`${button} shrink-0`} onClick={() => setDeletingId(phrase.id)}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1 pl-10 text-[11px] text-[#85777D]">
            <span>{phrase.type === 'memo' ? '메모' : '제목'} · 사용 {phrase.usageCount}회</span>
            <div className="flex items-center gap-1">
              {onSelectPhrase && <button type="button" className={button} onClick={() => select(phrase)}>선택</button>}
              {managing && ([-1, 1] as const).map(direction => {
                const target = visible[index + direction];
                return <button key={direction} type="button" aria-label={direction === -1 ? '위로 이동' : '아래로 이동'} className={button} disabled={sort !== 'manual' || !!search || !target || target.isFavorite !== phrase.isFavorite} onClick={() => void run(async () => {
                  const ids = ordered.map(p => p.id);
                  const a = ids.indexOf(phrase.id), b = ids.indexOf(target.id);
                  [ids[a], ids[b]] = [ids[b], ids[a]];
                  await onReorderPresets(ids);
                })}>{direction === -1 ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}</button>;
              })}
            </div>
          </div>
          {deletingId === phrase.id && <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[#C4476B]" role="group" aria-label="문구 삭제 확인">
            <span>이 문구를 삭제할까요?</span>
            <button type="button" className={primary} onClick={() => void run(async () => { await onDeletePreset(phrase.id); setDeletingId(null); })}>삭제 확인</button>
            <button type="button" className={button} onClick={() => setDeletingId(null)}>취소</button>
          </div>}
        </>}
      </li>)}
    </ul>
    <form className="border-t border-[#F0E7EB] pt-3 space-y-2" onSubmit={e => {
      e.preventDefault();
      if (!newText.trim()) return;
      void run(async () => {
        const now = Date.now();
        draftId.current ??= crypto.randomUUID();
        await onSavePreset({ id: draftId.current, type: newType, text: newText.trim(), isFavorite: favorite, usageCount: 0, lastUsedAt: 0, createdAt: now, updatedAt: now, sortOrder: Math.max(0, ...presets.map(phraseOrder)) + 1 });
        draftId.current = null;
        setNewText(''); setFavorite(false); setFilter(newType); setQuery(''); setFavoritesOnly(false);
      });
    }}>
      <label className="text-xs font-semibold text-[#3E3438] block" htmlFor={newInputId}>새 문구 추가</label>
      <input id={newInputId} className={input} placeholder="새 문구 내용을 입력하세요" required value={newText} onChange={e => setNewText(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#85777D]">
        <select aria-label="새 문구 종류" value={newType} onChange={e => setNewType(e.target.value as PhraseType)} className="min-h-9 bg-white border border-[#F0E7EB] rounded-lg px-1"><option value="title">일정 제목</option><option value="memo">메모</option></select>
        <label className="flex min-h-9 items-center gap-1"><input type="checkbox" checked={favorite} onChange={e => setFavorite(e.target.checked)} />즐겨찾기</label>
        <button type="submit" disabled={!newText.trim()} className={`${primary} ml-auto`}>새 문구 추가</button>
      </div>
    </form>
  </fieldset>;
}

export function PhraseManageModal({ isOpen, onClose, ...props }: PhraseActions & { isOpen: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => previousFocus?.focus({ preventScroll: true });
  }, [isOpen]);
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-xs" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
    <div role="dialog" aria-modal="true" aria-labelledby="phrase-modal-title" className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-[#F0E7EB] max-h-[90dvh] overflow-y-auto p-4 sm:p-5 safe-bottom">
      <div className="w-9 h-1 rounded-full bg-[#F0E7EB] mx-auto mb-3 sm:hidden" />
      <div className="flex items-center justify-between mb-3"><h3 id="phrase-modal-title" className="text-sm font-bold text-[#3E3438]">자주 쓰는 문구</h3><button ref={closeRef} type="button" onClick={onClose} aria-label="문구 팝업 닫기" className={button}><X className="w-4 h-4" /></button></div>
      <PhraseManager {...props} />
    </div>
  </div>;
}
